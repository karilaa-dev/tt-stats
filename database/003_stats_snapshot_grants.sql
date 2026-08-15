-- Usage: psql "$ADMIN_DATABASE_URL" -v app_role=tt_stats -f database/003_stats_snapshot_grants.sql
\if :{?app_role}
\else
  \echo 'Set -v app_role=<existing-application-role>'
  \quit
\endif

GRANT CONNECT, TEMPORARY ON DATABASE :"DBNAME" TO :"app_role";
GRANT USAGE ON SCHEMA public, cron TO :"app_role";
GRANT SELECT ON TABLE public.users, public.videos, public.music TO :"app_role";

GRANT USAGE ON SCHEMA tt_stats_cache TO :"app_role";
GRANT SELECT ON tt_stats_cache.refresh_metadata,
                tt_stats_cache.breakdown,
                tt_stats_cache.time_series,
                tt_stats_cache.rankings,
                tt_stats_cache.scalars
TO :"app_role";

GRANT SELECT, UPDATE ON tt_stats_cache.video_inactivity_monitor
TO :"app_role";

GRANT EXECUTE ON FUNCTION tt_stats_cache.list_stats_jobs() TO :"app_role";
GRANT EXECUTE ON FUNCTION tt_stats_cache.list_stats_job_runs(TEXT, INTEGER) TO :"app_role";
GRANT EXECUTE ON FUNCTION tt_stats_cache.update_stats_job_schedule(TEXT, TEXT) TO :"app_role";
GRANT EXECUTE ON FUNCTION tt_stats_cache.set_stats_job_active(TEXT, BOOLEAN) TO :"app_role";
GRANT EXECUTE ON FUNCTION tt_stats_cache.request_stats_job_run(TEXT) TO :"app_role";
GRANT EXECUTE ON FUNCTION tt_stats_cache.get_manual_refresh_request(BIGINT) TO :"app_role";
