DO $$ BEGIN
  IF to_regnamespace('tt_stats_web') IS NULL THEN
    CREATE SCHEMA tt_stats_web;
    REVOKE ALL ON SCHEMA tt_stats_web FROM PUBLIC;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('tt_stats_web.users') IS NULL THEN
    CREATE TABLE tt_stats_web.users (
  telegram_id BIGINT PRIMARY KEY CHECK (telegram_id > 0),
  display_name TEXT NOT NULL,
  username TEXT,
  first_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    REVOKE ALL ON TABLE tt_stats_web.users FROM PUBLIC;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('tt_stats_web.sessions') IS NULL THEN
    CREATE TABLE tt_stats_web.sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES tt_stats_web.users(telegram_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
    );
    REVOKE ALL ON TABLE tt_stats_web.sessions FROM PUBLIC;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS website_sessions_expiry ON tt_stats_web.sessions(expires_at);
CREATE INDEX IF NOT EXISTS website_sessions_user ON tt_stats_web.sessions(telegram_id);
DO $$ BEGIN
  IF to_regclass('tt_stats_web.login_transactions') IS NULL THEN
    CREATE TABLE tt_stats_web.login_transactions (
  token_hash TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
    );
    REVOKE ALL ON TABLE tt_stats_web.login_transactions FROM PUBLIC;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS website_login_expiry ON tt_stats_web.login_transactions(expires_at);
DO $$ BEGIN
  IF to_regclass('tt_stats_web.query_cache') IS NULL THEN
    CREATE TABLE tt_stats_web.query_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB,
  computed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  lease_token TEXT,
  lease_until TIMESTAMPTZ
    );
    REVOKE ALL ON TABLE tt_stats_web.query_cache FROM PUBLIC;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS website_cache_expiry ON tt_stats_web.query_cache(expires_at);
CREATE INDEX IF NOT EXISTS website_cache_lease ON tt_stats_web.query_cache(lease_until);
