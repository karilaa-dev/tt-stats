-- Source: https://github.com/karilaa-dev/tt-bot/blob/v6.0.10/src/db/migrations.ts
-- Release commit: 063c236c27a64fcfe90ac4bd832aa0e5cb872a91
-- Verbatim source-table definitions, validator, and indexes used by runMigrations.

CREATE OR REPLACE FUNCTION is_valid_telegram_files(value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $function$
DECLARE
  item JSONB;
  expected_position INTEGER := 0;
BEGIN
  IF value IS NULL THEN RETURN TRUE; END IF;
  IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(value) = 0 THEN RETURN FALSE; END IF;
  FOR item IN SELECT element FROM jsonb_array_elements(value) AS entries(element) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN FALSE; END IF;
    IF jsonb_typeof(item->'position') IS DISTINCT FROM 'number'
      OR item->>'position' IS DISTINCT FROM expected_position::TEXT
      OR COALESCE(item->>'media_type', '') NOT IN ('photo', 'video')
      OR jsonb_typeof(item->'file_id') IS DISTINCT FROM 'string'
      OR COALESCE(length(item->>'file_id'), 0) = 0
      OR jsonb_typeof(item->'file_unique_id') IS DISTINCT FROM 'string'
      OR COALESCE(length(item->>'file_unique_id'), 0) = 0
    THEN RETURN FALSE; END IF;
    expected_position := expected_position + 1;
  END LOOP;
  RETURN TRUE;
END
$function$;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    registered_at BIGINT,
    lang VARCHAR NOT NULL DEFAULT 'en',
    link VARCHAR,
    file_mode BOOLEAN NOT NULL DEFAULT FALSE,
    richads_last_shown_at BIGINT
  );

CREATE TABLE IF NOT EXISTS video_details (
    pk_id BIGSERIAL PRIMARY KEY,
    platform VARCHAR NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
    platform_video_id VARCHAR NOT NULL,
    creator_username VARCHAR,
    content_type VARCHAR,
    canonical_link TEXT,
    telegram_bot_id BIGINT,
    telegram_files JSONB,
    likes_display VARCHAR,
    views_display VARCHAR,
    first_downloaded_at BIGINT,
    last_used_at BIGINT,
    metadata_refreshed_at BIGINT,
    file_ids_updated_at BIGINT,
    cache_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT video_details_platform_id_key UNIQUE (platform, platform_video_id),
    CONSTRAINT video_details_telegram_pair_check CHECK ((telegram_bot_id IS NULL) = (telegram_files IS NULL)),
    CONSTRAINT video_details_telegram_files_check CHECK (is_valid_telegram_files(telegram_files))
  );

CREATE TABLE IF NOT EXISTS videos (
    pk_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    video_details_id BIGINT REFERENCES video_details(pk_id),
    downloaded_at BIGINT,
    shared_link TEXT NOT NULL,
    media_kind VARCHAR NOT NULL CHECK (media_kind IN ('video', 'images')),
    delivery_surface VARCHAR NOT NULL CHECK (delivery_surface IN ('chat', 'inline')),
    delivery_mode VARCHAR CHECK (delivery_mode IN ('media', 'document')),
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE
  );

CREATE TABLE IF NOT EXISTS music (
    pk_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    downloaded_at BIGINT,
    video_id BIGINT NOT NULL
  );

CREATE INDEX IF NOT EXISTS video_details_last_used_idx ON video_details (last_used_at DESC);

CREATE INDEX IF NOT EXISTS videos_user_downloaded_idx ON videos (user_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS videos_downloaded_brin_idx ON videos USING BRIN (downloaded_at);

CREATE INDEX IF NOT EXISTS videos_details_idx ON videos (video_details_id) WHERE video_details_id IS NOT NULL;
