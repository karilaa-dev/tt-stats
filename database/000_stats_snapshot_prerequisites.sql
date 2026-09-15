-- Run once as a PostgreSQL administrator after pg_cron is preloaded.
-- Usage:
--   psql "$DB_URL" -v app_role=tt_stats \
--     -f database/000_stats_snapshot_prerequisites.sql
\if :{?app_role}
\else
  \echo 'Set -v app_role=<existing-application-role>'
  \quit
\endif

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- DB_URL is the administrative connection. CREATE is needed for installation;
-- TEMPORARY is also needed at runtime by the snapshot refresh procedures.
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE :"DBNAME" TO :"app_role";
GRANT USAGE ON SCHEMA public, cron TO :"app_role";
GRANT SELECT ON TABLE public.users, public.videos, public.music, public.video_details TO :"app_role";
