import "@/lib/server-only"

// Account-scoped before sorting or joining metadata. Music stores the TikTok
// post ID, not a videos.pk_id. Negative internal keys keep both event sequences
// distinct; public audio IDs are prefixed before leaving the history reader.
export const userHistorySql = `SELECT pk_id, pk_id AS event_id, user_id, downloaded_at, shared_link,
    media_kind, cache_hit, video_details_id, NULL::text AS audio_video_id
  FROM public.videos WHERE user_id = $1::bigint
  UNION ALL
  SELECT -m.pk_id, m.pk_id, m.user_id, m.downloaded_at,
    'https://www.tiktok.com/@/video/' || m.video_id::text,
    'audio', false, d.pk_id, m.video_id::text
  FROM public.music m LEFT JOIN public.video_details d
    ON d.platform = 'tiktok' AND d.platform_video_id = m.video_id::text
  WHERE m.user_id = $1::bigint`

// Shared by ordinary page comparisons and the bounded ranking paths. Audio
// popularity and first-downloader status compare audio events only.
export function historyMatches(source: string) {
  return `SELECT user_id, downloaded_at, pk_id FROM public.videos
    WHERE ${source}.audio_video_id IS NULL
      AND ${source}.video_details_id IS NOT NULL
      AND video_details_id = ${source}.video_details_id AND user_id <> 0
    UNION ALL
    SELECT user_id, downloaded_at, pk_id FROM public.music
    WHERE ${source}.audio_video_id IS NOT NULL
      AND video_id = ${source}.audio_video_id::bigint AND user_id <> 0`
}
