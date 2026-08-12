-- Run once as a PostgreSQL administrator after pg_cron is preloaded.
-- Usage:
--   psql "$ADMIN_DATABASE_URL" -v app_role=tt_stats \
--     -f database/000_stats_snapshot_prerequisites.sql
\if :{?app_role}
\else
  \echo 'Set -v app_role=<existing-application-role>'
  \quit
\endif

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- DB_URL stays non-superuser. CREATE is needed only for guided install/repair;
-- TEMPORARY is also needed at runtime by the snapshot refresh procedures.
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE :"DBNAME" TO :"app_role";
GRANT USAGE ON SCHEMA public, cron TO :"app_role";
GRANT SELECT ON TABLE public.users, public.videos, public.music TO :"app_role";
