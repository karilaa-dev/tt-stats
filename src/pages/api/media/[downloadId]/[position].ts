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
  streamTelegramFile,
} from "@/lib/media/telegram"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"

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
  const principal = getPrincipal(cookies)
  const { downloadId = "", position = "" } = params
  if (
    !/^[1-9]\d{0,18}$/u.test(downloadId) ||
    BigInt(downloadId) > 9223372036854775807n ||
    !/^\d{1,4}$/u.test(position)
  )
    return fail("Invalid media request.", 400)
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
    const media = await getStoredMedia(downloadId)
    const reason = mediaUnavailableReason(media)
    if (reason) {
      release?.()
      return fail(reason, 404)
    }
    const file = media?.telegram_files?.find(
      (item) => item.position === Number(position)
    )
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
