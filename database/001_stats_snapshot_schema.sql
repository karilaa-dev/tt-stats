BEGIN;

CREATE SCHEMA IF NOT EXISTS tt_stats_cache;
REVOKE ALL ON SCHEMA tt_stats_cache FROM PUBLIC;

CREATE TABLE IF NOT EXISTS tt_stats_cache.refresh_metadata (
  dataset TEXT PRIMARY KEY CHECK (dataset IN ('rolling_24h', 'daily')),
  refreshed_at TIMESTAMPTZ NOT NULL,
  window_start_epoch BIGINT NOT NULL,
  window_end_epoch BIGINT NOT NULL,
  CHECK (window_start_epoch <= window_end_epoch)
);

CREATE TABLE IF NOT EXISTS tt_stats_cache.breakdown (
  scope TEXT NOT NULL CHECK (scope IN ('users', 'groups', 'all')),
  range TEXT NOT NULL CHECK (range IN ('24h', '7d', '31d', 'all')),
  chats BIGINT NOT NULL CHECK (chats >= 0),
  downloads BIGINT NOT NULL CHECK (downloads >= 0),
  download_users BIGINT NOT NULL CHECK (download_users >= 0),
  images BIGINT NOT NULL CHECK (images >= 0),
  image_users BIGINT NOT NULL CHECK (image_users >= 0),
  music BIGINT NOT NULL CHECK (music >= 0),
  music_users BIGINT NOT NULL CHECK (music_users >= 0),
  PRIMARY KEY (scope, range)
);

CREATE TABLE IF NOT EXISTS tt_stats_cache.time_series (
  metric TEXT NOT NULL CHECK (metric IN ('users', 'videos', 'music')),
  range TEXT NOT NULL CHECK (range IN ('24h', '7d', '31d', 'all')),
  bucket_epoch BIGINT NOT NULL,
  count BIGINT NOT NULL CHECK (count >= 0),
  PRIMARY KEY (metric, range, bucket_epoch)
);

CREATE TABLE IF NOT EXISTS tt_stats_cache.rankings (
  category TEXT NOT NULL CHECK (
    category IN ('referrals', 'languages', 'top_downloaders')
  ),
  position INTEGER NOT NULL CHECK (position > 0),
  value TEXT NOT NULL,
  count BIGINT NOT NULL CHECK (count >= 0),
  PRIMARY KEY (category, position)
);

CREATE TABLE IF NOT EXISTS tt_stats_cache.scalars (
  name TEXT PRIMARY KEY CHECK (name IN ('file_mode_users')),
  value BIGINT NOT NULL CHECK (value >= 0)
);

CREATE TABLE IF NOT EXISTS tt_stats_cache.manual_refresh_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset TEXT NOT NULL CHECK (dataset IN ('rolling_24h', 'daily')),
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed')
  ),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  sqlstate TEXT CHECK (sqlstate IS NULL OR sqlstate ~ '^[0-9A-Z]{5}$'),
  job_name TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS tt_stats_manual_refresh_requested_idx
  ON tt_stats_cache.manual_refresh_requests (requested_at DESC);

CREATE OR REPLACE FUNCTION tt_stats_cache._job_name(p_dataset TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
BEGIN
  CASE p_dataset
    WHEN 'rolling_24h' THEN RETURN 'tt-stats-rolling-24h';
    WHEN 'daily' THEN RETURN 'tt-stats-daily';
    ELSE RAISE EXCEPTION 'unknown statistics dataset' USING ERRCODE = '22023';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache._series_rows(
  p_metric TEXT,
  p_range TEXT,
  p_start_epoch BIGINT,
  p_end_epoch BIGINT,
  p_bucket_seconds BIGINT
)
RETURNS TABLE (
  metric TEXT,
  range TEXT,
  bucket_epoch BIGINT,
  count BIGINT
)
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_table TEXT;
  v_column TEXT;
BEGIN
  CASE p_metric
    WHEN 'users' THEN
      v_table := 'users';
      v_column := 'registered_at';
    WHEN 'videos' THEN
      v_table := 'videos';
      v_column := 'downloaded_at';
    WHEN 'music' THEN
      v_table := 'music';
      v_column := 'downloaded_at';
    ELSE
      RAISE EXCEPTION 'unknown series metric' USING ERRCODE = '22023';
  END CASE;

  IF p_range NOT IN ('24h', '7d', '31d', 'all') THEN
    RAISE EXCEPTION 'unknown statistics range' USING ERRCODE = '22023';
  END IF;

  IF p_start_epoch >= p_end_epoch THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    $query$
      WITH buckets AS (
        SELECT generate_series($1, $2 - $3, $3)::bigint AS bucket_epoch
      ),
      counts AS (
        SELECT
          (floor(%1$I::numeric / $3) * $3)::bigint AS bucket_epoch,
          count(*)::bigint AS count
        FROM public.%2$I
        WHERE user_id <> 0
          AND %1$I IS NOT NULL
          AND %1$I >= $1
          AND %1$I < $2
        GROUP BY 1
      )
      SELECT $4::text, $5::text, b.bucket_epoch, coalesce(c.count, 0)::bigint
      FROM buckets b
      LEFT JOIN counts c USING (bucket_epoch)
      ORDER BY b.bucket_epoch
    $query$,
    v_column,
    v_table
  ) USING p_start_epoch, p_end_epoch, p_bucket_seconds, p_metric, p_range;
END;
$$;

CREATE OR REPLACE PROCEDURE tt_stats_cache.refresh_rolling_24h(
  IN p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
LANGUAGE plpgsql
SET search_path = pg_catalog, tt_stats_cache
AS $$
DECLARE
  v_end_epoch BIGINT := floor(extract(epoch FROM p_now) / 3600)::bigint * 3600;
  v_start_epoch BIGINT := v_end_epoch - 86400;
BEGIN
  PERFORM pg_advisory_xact_lock(20260812, 1);

  CREATE TEMP TABLE tt_stats_breakdown_stage (
    LIKE tt_stats_cache.breakdown INCLUDING DEFAULTS
  ) ON COMMIT DROP;

  INSERT INTO tt_stats_breakdown_stage (
    scope, range, chats, downloads, download_users,
    images, image_users, music, music_users
  )
  SELECT scope, '24h', 0, 0, 0, 0, 0, 0, 0
  FROM (VALUES ('users'), ('groups'), ('all')) AS scopes(scope);

  WITH counts AS (
    SELECT
      CASE
        WHEN grouping(is_user) = 1 THEN 'all'
        WHEN is_user THEN 'users'
        ELSE 'groups'
      END AS scope,
      count(*)::bigint AS count
    FROM (
      SELECT user_id > 0 AS is_user
      FROM public.users
      WHERE user_id <> 0
        AND registered_at IS NOT NULL
        AND registered_at >= v_start_epoch
        AND registered_at < v_end_epoch
    ) source
    GROUP BY GROUPING SETS ((), (is_user))
  )
  UPDATE tt_stats_breakdown_stage target
  SET chats = counts.count
  FROM counts
  WHERE target.scope = counts.scope;

  WITH counts AS (
    SELECT
      CASE
        WHEN grouping(is_user) = 1 THEN 'all'
        WHEN is_user THEN 'users'
        ELSE 'groups'
      END AS scope,
      count(*)::bigint AS total,
      count(DISTINCT user_id)::bigint AS users,
      count(*) FILTER (WHERE media_kind = 'images')::bigint AS images,
      count(DISTINCT user_id) FILTER (
        WHERE media_kind = 'images'
      )::bigint AS image_users
    FROM (
      SELECT user_id, user_id > 0 AS is_user, media_kind
      FROM public.videos
      WHERE user_id <> 0
        AND downloaded_at IS NOT NULL
        AND downloaded_at >= v_start_epoch
        AND downloaded_at < v_end_epoch
    ) source
    GROUP BY GROUPING SETS ((), (is_user))
  )
  UPDATE tt_stats_breakdown_stage target
  SET downloads = counts.total,
      download_users = counts.users,
      images = counts.images,
      image_users = counts.image_users
  FROM counts
  WHERE target.scope = counts.scope;

  WITH counts AS (
    SELECT
      CASE
        WHEN grouping(is_user) = 1 THEN 'all'
        WHEN is_user THEN 'users'
        ELSE 'groups'
      END AS scope,
      count(*)::bigint AS total,
      count(DISTINCT user_id)::bigint AS users
    FROM (
      SELECT user_id, user_id > 0 AS is_user
      FROM public.music
      WHERE user_id <> 0
        AND downloaded_at IS NOT NULL
        AND downloaded_at >= v_start_epoch
        AND downloaded_at < v_end_epoch
    ) source
    GROUP BY GROUPING SETS ((), (is_user))
  )
  UPDATE tt_stats_breakdown_stage target
  SET music = counts.total,
      music_users = counts.users
  FROM counts
  WHERE target.scope = counts.scope;

  CREATE TEMP TABLE tt_stats_series_stage (
    LIKE tt_stats_cache.time_series INCLUDING DEFAULTS
  ) ON COMMIT DROP;

  INSERT INTO tt_stats_series_stage
  SELECT * FROM tt_stats_cache._series_rows(
    'users', '24h', v_start_epoch, v_end_epoch, 3600
  );
  INSERT INTO tt_stats_series_stage
  SELECT * FROM tt_stats_cache._series_rows(
    'videos', '24h', v_start_epoch, v_end_epoch, 3600
  );
  INSERT INTO tt_stats_series_stage
  SELECT * FROM tt_stats_cache._series_rows(
    'music', '24h', v_start_epoch, v_end_epoch, 3600
  );

  DELETE FROM tt_stats_cache.breakdown WHERE range = '24h';
  INSERT INTO tt_stats_cache.breakdown SELECT * FROM tt_stats_breakdown_stage;

  DELETE FROM tt_stats_cache.time_series WHERE range = '24h';
  INSERT INTO tt_stats_cache.time_series SELECT * FROM tt_stats_series_stage;

  INSERT INTO tt_stats_cache.refresh_metadata (
    dataset, refreshed_at, window_start_epoch, window_end_epoch
  ) VALUES ('rolling_24h', p_now, v_start_epoch, v_end_epoch)
  ON CONFLICT (dataset) DO UPDATE SET
    refreshed_at = excluded.refreshed_at,
    window_start_epoch = excluded.window_start_epoch,
    window_end_epoch = excluded.window_end_epoch;
END;
$$;

CREATE OR REPLACE PROCEDURE tt_stats_cache.refresh_daily(
  IN p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
LANGUAGE plpgsql
SET search_path = pg_catalog, tt_stats_cache
AS $$
DECLARE
  v_end_epoch BIGINT := floor(extract(epoch FROM p_now) / 86400)::bigint * 86400;
  v_all_start BIGINT;
  v_metric TEXT;
  v_minimum BIGINT;
  v_job_name TEXT;
  v_job_exists BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(20260812, 1);

  CREATE TEMP TABLE tt_stats_ranges (
    range TEXT PRIMARY KEY,
    start_epoch BIGINT
  ) ON COMMIT DROP;
  INSERT INTO tt_stats_ranges VALUES
    ('7d', v_end_epoch - 604800),
    ('31d', v_end_epoch - 2678400),
    ('all', NULL);

  CREATE TEMP TABLE tt_stats_breakdown_stage (
    LIKE tt_stats_cache.breakdown INCLUDING DEFAULTS
  ) ON COMMIT DROP;
  INSERT INTO tt_stats_breakdown_stage (
    scope, range, chats, downloads, download_users,
    images, image_users, music, music_users
  )
  SELECT scope, ranges.range, 0, 0, 0, 0, 0, 0, 0
  FROM (VALUES ('users'), ('groups'), ('all')) AS scopes(scope)
  CROSS JOIN tt_stats_ranges ranges;

  WITH counts AS (
    SELECT
      source.range,
      CASE
        WHEN grouping(is_user) = 1 THEN 'all'
        WHEN is_user THEN 'users'
        ELSE 'groups'
      END AS scope,
      count(*)::bigint AS count
    FROM (
      SELECT ranges.range, users.user_id > 0 AS is_user
      FROM tt_stats_ranges ranges
      JOIN public.users
        ON users.user_id <> 0
       AND users.registered_at IS NOT NULL
       AND users.registered_at < v_end_epoch
       AND (ranges.start_epoch IS NULL OR users.registered_at >= ranges.start_epoch)
    ) source
    GROUP BY source.range, GROUPING SETS ((), (is_user))
  )
  UPDATE tt_stats_breakdown_stage target
  SET chats = counts.count
  FROM counts
  WHERE target.range = counts.range AND target.scope = counts.scope;

  WITH counts AS (
    SELECT
      source.range,
      CASE
        WHEN grouping(is_user) = 1 THEN 'all'
        WHEN is_user THEN 'users'
        ELSE 'groups'
      END AS scope,
      count(*)::bigint AS total,
      count(DISTINCT user_id)::bigint AS users,
      count(*) FILTER (WHERE media_kind = 'images')::bigint AS images,
      count(DISTINCT user_id) FILTER (
        WHERE media_kind = 'images'
      )::bigint AS image_users
    FROM (
      SELECT ranges.range, videos.user_id, videos.user_id > 0 AS is_user,
             videos.media_kind
      FROM tt_stats_ranges ranges
      JOIN public.videos
        ON videos.user_id <> 0
       AND videos.downloaded_at IS NOT NULL
       AND videos.downloaded_at < v_end_epoch
       AND (ranges.start_epoch IS NULL OR videos.downloaded_at >= ranges.start_epoch)
    ) source
    GROUP BY source.range, GROUPING SETS ((), (is_user))
  )
  UPDATE tt_stats_breakdown_stage target
  SET downloads = counts.total,
      download_users = counts.users,
      images = counts.images,
      image_users = counts.image_users
  FROM counts
  WHERE target.range = counts.range AND target.scope = counts.scope;

  WITH counts AS (
    SELECT
      source.range,
      CASE
        WHEN grouping(is_user) = 1 THEN 'all'
        WHEN is_user THEN 'users'
        ELSE 'groups'
      END AS scope,
      count(*)::bigint AS total,
      count(DISTINCT user_id)::bigint AS users
    FROM (
      SELECT ranges.range, music.user_id, music.user_id > 0 AS is_user
      FROM tt_stats_ranges ranges
      JOIN public.music
        ON music.user_id <> 0
       AND music.downloaded_at IS NOT NULL
       AND music.downloaded_at < v_end_epoch
       AND (ranges.start_epoch IS NULL OR music.downloaded_at >= ranges.start_epoch)
    ) source
    GROUP BY source.range, GROUPING SETS ((), (is_user))
  )
  UPDATE tt_stats_breakdown_stage target
  SET music = counts.total,
      music_users = counts.users
  FROM counts
  WHERE target.range = counts.range AND target.scope = counts.scope;

  CREATE TEMP TABLE tt_stats_series_stage (
    LIKE tt_stats_cache.time_series INCLUDING DEFAULTS
  ) ON COMMIT DROP;

  FOREACH v_metric IN ARRAY ARRAY['users', 'videos', 'music'] LOOP
    INSERT INTO tt_stats_series_stage
    SELECT * FROM tt_stats_cache._series_rows(
      v_metric, '7d', v_end_epoch - 604800, v_end_epoch, 3600
    );
    INSERT INTO tt_stats_series_stage
    SELECT * FROM tt_stats_cache._series_rows(
      v_metric, '31d', v_end_epoch - 2678400, v_end_epoch, 86400
    );

    CASE v_metric
      WHEN 'users' THEN
        SELECT (floor(min(registered_at)::numeric / 86400) * 86400)::bigint
        INTO v_minimum
        FROM public.users
        WHERE user_id <> 0 AND registered_at IS NOT NULL
          AND registered_at < v_end_epoch;
      WHEN 'videos' THEN
        SELECT (floor(min(downloaded_at)::numeric / 86400) * 86400)::bigint
        INTO v_minimum
        FROM public.videos
        WHERE user_id <> 0 AND downloaded_at IS NOT NULL
          AND downloaded_at < v_end_epoch;
      WHEN 'music' THEN
        SELECT (floor(min(downloaded_at)::numeric / 86400) * 86400)::bigint
        INTO v_minimum
        FROM public.music
        WHERE user_id <> 0 AND downloaded_at IS NOT NULL
          AND downloaded_at < v_end_epoch;
    END CASE;

    IF v_minimum IS NOT NULL THEN
      v_all_start := least(coalesce(v_all_start, v_minimum), v_minimum);
      INSERT INTO tt_stats_series_stage
      SELECT * FROM tt_stats_cache._series_rows(
        v_metric, 'all', v_minimum, v_end_epoch, 86400
      );
    END IF;
  END LOOP;

  CREATE TEMP TABLE tt_stats_rankings_stage (
    LIKE tt_stats_cache.rankings INCLUDING DEFAULTS
  ) ON COMMIT DROP;

  INSERT INTO tt_stats_rankings_stage
  SELECT 'referrals', row_number() OVER (ORDER BY count(*) DESC, link ASC)::int,
         link, count(*)::bigint
  FROM public.users
  WHERE user_id <> 0
    AND registered_at IS NOT NULL
    AND registered_at < v_end_epoch
    AND link IS NOT NULL
  GROUP BY link
  ORDER BY count(*) DESC, link ASC
  LIMIT 10;

  INSERT INTO tt_stats_rankings_stage
  SELECT 'languages', row_number() OVER (ORDER BY count(*) DESC, lang ASC)::int,
         lang, count(*)::bigint
  FROM public.users
  WHERE user_id <> 0
    AND registered_at IS NOT NULL
    AND registered_at < v_end_epoch
  GROUP BY lang
  ORDER BY count(*) DESC, lang ASC;

  INSERT INTO tt_stats_rankings_stage
  SELECT 'top_downloaders',
         row_number() OVER (ORDER BY count(*) DESC, user_id ASC)::int,
         user_id::text, count(*)::bigint
  FROM public.videos
  WHERE user_id <> 0
    AND downloaded_at IS NOT NULL
    AND downloaded_at < v_end_epoch
  GROUP BY user_id
  ORDER BY count(*) DESC, user_id ASC
  LIMIT 10;

  CREATE TEMP TABLE tt_stats_scalars_stage (
    LIKE tt_stats_cache.scalars INCLUDING DEFAULTS
  ) ON COMMIT DROP;
  INSERT INTO tt_stats_scalars_stage
  SELECT 'file_mode_users', count(*)::bigint
  FROM public.users
  WHERE user_id <> 0
    AND registered_at IS NOT NULL
    AND registered_at < v_end_epoch
    AND file_mode = TRUE;

  DELETE FROM tt_stats_cache.breakdown WHERE range IN ('7d', '31d', 'all');
  INSERT INTO tt_stats_cache.breakdown SELECT * FROM tt_stats_breakdown_stage;

  DELETE FROM tt_stats_cache.time_series WHERE range IN ('7d', '31d', 'all');
  INSERT INTO tt_stats_cache.time_series SELECT * FROM tt_stats_series_stage;

  DELETE FROM tt_stats_cache.rankings;
  INSERT INTO tt_stats_cache.rankings SELECT * FROM tt_stats_rankings_stage;

  DELETE FROM tt_stats_cache.scalars;
  INSERT INTO tt_stats_cache.scalars SELECT * FROM tt_stats_scalars_stage;

  INSERT INTO tt_stats_cache.refresh_metadata (
    dataset, refreshed_at, window_start_epoch, window_end_epoch
  ) VALUES ('daily', p_now, coalesce(v_all_start, v_end_epoch), v_end_epoch)
  ON CONFLICT (dataset) DO UPDATE SET
    refreshed_at = excluded.refreshed_at,
    window_start_epoch = excluded.window_start_epoch,
    window_end_epoch = excluded.window_end_epoch;

  IF to_regprocedure('cron.unschedule(text)') IS NOT NULL THEN
    FOR v_job_name IN
      SELECT job_name
      FROM tt_stats_cache.manual_refresh_requests
      WHERE requested_at < p_now - interval '30 days'
        AND status = 'queued'
        AND job_name <> ''
    LOOP
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
      INTO v_job_exists
      USING v_job_name;
      IF v_job_exists THEN
        EXECUTE 'SELECT cron.unschedule($1)' USING v_job_name;
      END IF;
    END LOOP;
  END IF;

  DELETE FROM tt_stats_cache.manual_refresh_requests
  WHERE requested_at < p_now - interval '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache.list_stats_jobs()
RETURNS TABLE (
  dataset TEXT,
  job_name TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_status TEXT,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_duration_ms BIGINT,
  refreshed_at TIMESTAMPTZ,
  window_start_epoch BIGINT,
  window_end_epoch BIGINT,
  manual_request_id BIGINT,
  manual_status TEXT,
  manual_requested_at TIMESTAMPTZ,
  manual_started_at TIMESTAMPTZ,
  manual_finished_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, tt_stats_cache, pg_temp
AS $$
BEGIN
  -- Keep the core schema installable where pg_cron is deliberately absent,
  -- such as normal test databases. This resolves cron objects at call time.
  RETURN QUERY EXECUTE $query$
    WITH expected(dataset, job_name) AS (
      VALUES
        ('rolling_24h'::text, 'tt-stats-rolling-24h'::text),
        ('daily'::text, 'tt-stats-daily'::text)
    )
    SELECT expected.dataset,
           expected.job_name,
           job.schedule,
           coalesce(job.active, false),
           latest.status,
           latest.start_time,
           latest.end_time,
           CASE
             WHEN latest.start_time IS NULL OR latest.end_time IS NULL THEN NULL
             ELSE floor(extract(epoch FROM (latest.end_time - latest.start_time)) * 1000)::bigint
           END,
           metadata.refreshed_at,
           metadata.window_start_epoch,
           metadata.window_end_epoch,
           manual.id,
           manual.status,
           manual.requested_at,
           manual.started_at,
           manual.finished_at
    FROM expected
    LEFT JOIN cron.job job ON job.jobname = expected.job_name
    LEFT JOIN LATERAL (
      SELECT details.status, details.start_time, details.end_time
      FROM cron.job_run_details details
      WHERE details.jobid = job.jobid
      ORDER BY details.start_time DESC NULLS LAST, details.runid DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN tt_stats_cache.refresh_metadata metadata
      ON metadata.dataset = expected.dataset
    LEFT JOIN LATERAL (
      SELECT request.id, request.status, request.requested_at,
             request.started_at, request.finished_at
      FROM tt_stats_cache.manual_refresh_requests request
      WHERE request.dataset = expected.dataset
        AND request.status IN ('queued', 'running')
      ORDER BY request.requested_at DESC, request.id DESC
      LIMIT 1
    ) manual ON true
    ORDER BY expected.dataset DESC
  $query$;
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache.list_stats_job_runs(
  p_dataset TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  run_id BIGINT,
  status TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, tt_stats_cache, pg_temp
AS $$
DECLARE
  v_job_name TEXT := tt_stats_cache._job_name(p_dataset);
BEGIN
  IF p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'run history limit is out of range' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT details.runid,
         details.status,
         details.start_time,
         details.end_time,
         CASE
           WHEN details.start_time IS NULL OR details.end_time IS NULL THEN NULL
           ELSE floor(extract(epoch FROM details.end_time - details.start_time) * 1000)::bigint
         END
  FROM cron.job job
  JOIN cron.job_run_details details USING (jobid)
  WHERE job.jobname = v_job_name
  ORDER BY details.start_time DESC NULLS LAST, details.runid DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache.update_stats_job_schedule(
  p_dataset TEXT,
  p_schedule TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, tt_stats_cache, pg_temp
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF p_schedule IS NULL OR btrim(p_schedule) = '' OR length(p_schedule) > 100
     OR p_schedule ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid cron schedule' USING ERRCODE = '22023';
  END IF;

  SELECT jobid INTO STRICT v_job_id
  FROM cron.job
  WHERE jobname = tt_stats_cache._job_name(p_dataset);

  PERFORM cron.alter_job(v_job_id, schedule := btrim(p_schedule));
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache.set_stats_job_active(
  p_dataset TEXT,
  p_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, tt_stats_cache, pg_temp
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO STRICT v_job_id
  FROM cron.job
  WHERE jobname = tt_stats_cache._job_name(p_dataset);

  PERFORM cron.alter_job(v_job_id, active := p_active);
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache.request_stats_job_run(
  p_dataset TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, tt_stats_cache, pg_temp
AS $$
DECLARE
  v_request_id BIGINT;
  v_job_name TEXT;
  v_command TEXT;
BEGIN
  PERFORM tt_stats_cache._job_name(p_dataset);

  SELECT request.id INTO v_request_id
  FROM tt_stats_cache.manual_refresh_requests request
  WHERE request.dataset = p_dataset
    AND request.status IN ('queued', 'running')
  ORDER BY request.requested_at DESC, request.id DESC
  LIMIT 1;

  -- Repeated clicks and setup retries share the request already in flight.
  IF v_request_id IS NOT NULL THEN
    RETURN v_request_id;
  END IF;

  INSERT INTO tt_stats_cache.manual_refresh_requests (dataset, status)
  VALUES (p_dataset, 'queued')
  RETURNING id INTO v_request_id;

  v_job_name := 'tt-stats-manual-' || v_request_id::text;
  v_command := format(
    'CALL tt_stats_cache.run_manual_refresh(%s, %L, %L)',
    v_request_id,
    p_dataset,
    v_job_name
  );

  UPDATE tt_stats_cache.manual_refresh_requests
  SET job_name = v_job_name
  WHERE id = v_request_id;

  PERFORM cron.schedule(v_job_name, '* * * * *', v_command);
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE PROCEDURE tt_stats_cache.run_manual_refresh(
  IN p_request_id BIGINT,
  IN p_dataset TEXT,
  IN p_job_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, tt_stats_cache, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM tt_stats_cache.manual_refresh_requests
  WHERE id = p_request_id AND dataset = p_dataset AND job_name = p_job_name
  FOR UPDATE;

  IF v_status IS DISTINCT FROM 'queued' THEN
    RETURN;
  END IF;

  PERFORM cron.unschedule(p_job_name);
  UPDATE tt_stats_cache.manual_refresh_requests
  SET status = 'running', started_at = clock_timestamp()
  WHERE id = p_request_id;

  BEGIN
    CASE p_dataset
      WHEN 'rolling_24h' THEN CALL tt_stats_cache.refresh_rolling_24h();
      WHEN 'daily' THEN CALL tt_stats_cache.refresh_daily();
      ELSE RAISE EXCEPTION 'unknown statistics dataset' USING ERRCODE = '22023';
    END CASE;

    UPDATE tt_stats_cache.manual_refresh_requests
    SET status = 'succeeded', finished_at = clock_timestamp(), sqlstate = NULL
    WHERE id = p_request_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE tt_stats_cache.manual_refresh_requests
    SET status = 'failed', finished_at = clock_timestamp(), sqlstate = SQLSTATE
    WHERE id = p_request_id;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION tt_stats_cache.get_manual_refresh_request(
  p_request_id BIGINT
)
RETURNS TABLE (
  id BIGINT,
  dataset TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, tt_stats_cache, pg_temp
AS $$
  SELECT request.id, request.dataset, request.status,
         request.requested_at, request.started_at, request.finished_at
  FROM tt_stats_cache.manual_refresh_requests request
  WHERE request.id = p_request_id;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA tt_stats_cache FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA tt_stats_cache FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tt_stats_cache FROM PUBLIC;
REVOKE ALL ON PROCEDURE tt_stats_cache.refresh_rolling_24h(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON PROCEDURE tt_stats_cache.refresh_daily(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON PROCEDURE tt_stats_cache.run_manual_refresh(BIGINT, TEXT, TEXT) FROM PUBLIC;

COMMIT;
