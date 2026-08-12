-- Run this file with psql outside an explicit transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_users_registered_at_idx
  ON public.users (registered_at)
  WHERE user_id <> 0 AND registered_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_videos_downloaded_at_idx
  ON public.videos (downloaded_at, user_id) INCLUDE (media_kind)
  WHERE user_id <> 0 AND downloaded_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_music_downloaded_at_idx
  ON public.music (downloaded_at, user_id)
  WHERE user_id <> 0 AND downloaded_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_videos_user_history_idx
  ON public.videos (user_id, downloaded_at DESC, pk_id DESC)
  INCLUDE (shared_link, media_kind);
