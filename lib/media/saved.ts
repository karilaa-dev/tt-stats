import "@/lib/server-only"

// The bot validates telegram_files as a non-empty, ordered array of file IDs.
// Return only availability to clients, never the Telegram file IDs themselves.
// The expression argument is an internal SQL column reference, not user input.
export function savedMediaSql(videoDetailsId: string) {
  return `EXISTS (SELECT 1 FROM public.video_details saved_media
    WHERE saved_media.pk_id = ${videoDetailsId}
      AND NULLIF(btrim(saved_media.telegram_files->0->>'file_id'), '') IS NOT NULL)`
}
