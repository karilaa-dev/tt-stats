DO $$
DECLARE
  job RECORD;
BEGIN
  FOR job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('tt-stats-rolling-24h', 'tt-stats-daily')
       OR jobname LIKE 'tt-stats-manual-%'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END;
$$;

DROP SCHEMA IF EXISTS tt_stats_cache CASCADE;

-- Source indexes are intentionally retained because they also improve live lookup.
