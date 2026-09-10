import "@/lib/server-only"
import type { StoredMedia } from "./queries"
import type { DownloadMedia } from "./types"

export function mediaUnavailableReason(
  media: StoredMedia | null,
  token = process.env.BOT_TOKEN
): string | null {
  if (!media?.telegram_files?.length)
    return "No saved media is available for this download."
  if (!token || !/^\d+:[A-Za-z0-9_-]+$/u.test(token))
    return "Configure BOT_TOKEN on the server to view saved media."
  if (media.telegram_bot_id !== token.split(":")[0])
    return "The saved media belongs to a different Telegram bot."
  return null
}

export function describeMedia(
  downloadId: string,
  media: StoredMedia | null
): DownloadMedia {
  const unavailableReason = mediaUnavailableReason(media)
  return {
    unavailableReason,
    items: unavailableReason
      ? []
      : (media?.telegram_files ?? []).map((file) => ({
          position: file.position,
          mediaType: file.media_type,
          url: `/api/media/${downloadId}/${file.position}`,
        })),
  }
}

export class MediaError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message)
  }
}

// Resolve and stream through the app so the bot token and Telegram URL never
// reach the browser, logs, redirects, or a shared HTTP cache.
export async function streamTelegramFile(
  file: NonNullable<StoredMedia["telegram_files"]>[number],
  request: Request,
  token = process.env.BOT_TOKEN!,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch
): Promise<Response> {
  const range = request.headers.get("range")
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/u.test(range))
    throw new MediaError("Invalid media range.", 416)
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)])
  try {
    const metadata = await fetcher(
      `https://api.telegram.org/bot${token}/getFile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: file.file_id }),
        signal,
        redirect: "error",
      }
    )
    const result = await metadata.json()
    if (
      !metadata.ok ||
      !result.ok ||
      typeof result.result?.file_path !== "string"
    ) {
      throw new MediaError(
        result.description?.includes("file is too big")
          ? "This file exceeds Telegram's 20 MB preview limit. Open the original post."
          : "Telegram could not retrieve this saved file. Open the original post."
      )
    }
    const path = result.result.file_path as string
    if (
      !/^[A-Za-z0-9_./-]+$/u.test(path) ||
      path.startsWith("/") ||
      path.split("/").includes("..")
    ) {
      throw new MediaError("Telegram returned an invalid file path.")
    }
    const upstream = await fetcher(
      `https://api.telegram.org/file/bot${token}/${path}`,
      {
        headers: range ? { Range: range } : {},
        signal,
        redirect: "error",
      }
    )
    if (![200, 206, 416].includes(upstream.status)) {
      await upstream.body?.cancel()
      throw new MediaError(
        "Telegram could not retrieve this saved file. Try again."
      )
    }
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": file.media_type === "video" ? "video/mp4" : "image/jpeg",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
    })
    for (const name of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    if (error instanceof MediaError) throw error
    throw new MediaError(
      "The saved media could not be loaded. Try again or open the original post."
    )
  }
}
