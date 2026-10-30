import type { APIRoute } from "astro"
import { getPrincipal } from "@/lib/auth/session"
import { canReadMedia } from "@/lib/media/access"
import {
  acquireStream,
  principalKey,
  trackStream,
} from "@/lib/security/rate-limit"
import { getStoredMedia } from "@/lib/media/queries"
import {
  MediaError,
  mediaUnavailableReason,
  savedSoundFile,
  streamTelegramFile,
} from "@/lib/media/telegram"
import { parseMediaIdParam } from "@/lib/media/ids"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"

// Astro otherwise invokes GET for HEAD and discards its streaming body without
// cancellation, leaving the upstream request and concurrency slot open.
export const HEAD: APIRoute = () =>
  new Response(null, {
    status: 405,
    headers: { Allow: "GET", "Cache-Control": "no-store" },
  })

export const GET: APIRoute = async ({
  params,
  request,
  cookies,
  clientAddress,
}) => {
  const fail = (message: string, status: number) =>
    Response.json(
      { message },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      }
    )
  const principal = await getPrincipal(cookies)
  const { position = "" } = params
  const media = parseMediaIdParam(params.downloadId)
  if (!media || !/^\d{1,4}$/u.test(position))
    return fail("Invalid media request.", 400)
  const downloadId = `${media.kind === "audio" ? "audio:" : ""}${media.id}`
  if (isFakeDataEnabled())
    return fail("Saved media is unavailable in demo mode.", 404)
  let release: (() => void) | undefined
  try {
    if (!(await canReadMedia(principal, downloadId)))
      return fail("Saved media is unavailable.", 404)
    if (!principal.admin) {
      release =
        acquireStream(principalKey(principal, clientAddress)) ?? undefined
      if (!release)
        return Response.json(
          { message: "Too many previews open. Close one and try again." },
          {
            status: 429,
            headers: { "Retry-After": "2", "Cache-Control": "no-store" },
          }
        )
    }
    const stored = await getStoredMedia(downloadId)
    const reason = mediaUnavailableReason(stored)
    if (reason) {
      release?.()
      return fail(reason, 404)
    }
    // Audio exposes only the saved video's sound file, never album photos.
    const file = (
      media.kind === "audio"
        ? [savedSoundFile(stored)]
        : (stored?.telegram_files ?? [])
    ).find((item) => item?.position === Number(position))
    if (!file) {
      release?.()
      return fail("Media item not found.", 404)
    }
    const response = await streamTelegramFile(file, request)
    return release ? trackStream(response, release, request.signal) : response
  } catch (error) {
    release?.()
    return fail(
      error instanceof MediaError
        ? error.message
        : "Saved media is unavailable.",
      error instanceof MediaError ? error.status : 503
    )
  }
}
