-- pg_cron must be preloaded, configured, and created in this database by an
-- administrator. See database/000_stats_snapshot_prerequisites.sql.
-- Set cron.timezone = 'UTC' in PostgreSQL configuration before installing jobs.

CALL tt_stats_cache.refresh_rolling_24h();
CALL tt_stats_cache.refresh_daily();

SELECT cron.schedule(
  'tt-stats-rolling-24h',
  '*/5 * * * *',
  'CALL tt_stats_cache.refresh_rolling_24h()'
);

SELECT cron.schedule(
  'tt-stats-daily',
  '7 0 * * *',
  'CALL tt_stats_cache.refresh_daily()'
);
