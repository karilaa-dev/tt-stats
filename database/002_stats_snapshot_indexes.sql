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

-- Identity comparisons serve history badges and scoped popularity filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_videos_identity_chats_idx
  ON public.videos (video_details_id, user_id, downloaded_at, pk_id)
  WHERE video_details_id IS NOT NULL AND user_id <> 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_videos_identity_first_idx
  ON public.videos (video_details_id, downloaded_at, pk_id) INCLUDE (user_id)
  WHERE video_details_id IS NOT NULL AND user_id <> 0;

-- Hash the unbounded URL instead of putting potentially long text in a B-tree.
CREATE INDEX CONCURRENTLY IF NOT EXISTS tt_stats_videos_legacy_link_idx
  ON public.videos (md5(shared_link), media_kind, downloaded_at, pk_id) INCLUDE (user_id)
  WHERE video_details_id IS NULL AND user_id <> 0;
