import "@/lib/server-only"

// The bot validates telegram_files as a non-empty, ordered array of file IDs.
// Return only availability to clients, never the Telegram file IDs themselves.
// The expression argument is an internal SQL column reference, not user input.
export function savedMediaSql(videoDetailsId: string) {
  return `EXISTS (SELECT 1 FROM public.video_details saved_media
    WHERE saved_media.pk_id = ${videoDetailsId}
      AND NULLIF(btrim(saved_media.telegram_files->0->>'file_id'), '') IS NOT NULL)`
}

// The bot does not store the audio files it sends. Audio plays the sound track
// of the post's saved video, so slideshows (photos only) have no sound.
export function savedSoundSql(videoDetailsId: string) {
  return `EXISTS (SELECT 1 FROM public.video_details saved_sound
    WHERE saved_sound.pk_id = ${videoDetailsId}
      AND saved_sound.telegram_files->0->>'media_type' = 'video'
      AND NULLIF(btrim(saved_sound.telegram_files->0->>'file_id'), '') IS NOT NULL)`
}

/** Saved media for videos and albums; a saved sound for audio history. */
export function savedHistoryMediaSql(source: string) {
  return `CASE WHEN ${source}.media_kind = 'audio'
    THEN ${savedSoundSql(`${source}.video_details_id`)}
    ELSE ${savedMediaSql(`${source}.video_details_id`)} END`
}
