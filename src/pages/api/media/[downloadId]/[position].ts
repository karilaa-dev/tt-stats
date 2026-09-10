import type { APIRoute } from "astro"
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin/session"
import { getStoredMedia } from "@/lib/media/queries"
import {
  MediaError,
  mediaUnavailableReason,
  streamTelegramFile,
} from "@/lib/media/telegram"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const fail = (message: string, status: number) =>
    Response.json(
      { message },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      }
    )
  if (!verifyAdminSession(cookies.get(ADMIN_COOKIE)?.value))
    return fail("Admin access required.", 401)
  const { downloadId = "", position = "" } = params
  if (
    !/^[1-9]\d{0,18}$/u.test(downloadId) ||
    BigInt(downloadId) > 9223372036854775807n ||
    !/^\d{1,4}$/u.test(position)
  )
    return fail("Invalid media request.", 400)
  if (isFakeDataEnabled())
    return fail("Saved media is unavailable in demo mode.", 404)
  try {
    const media = await getStoredMedia(downloadId)
    const reason = mediaUnavailableReason(media)
    if (reason) return fail(reason, 404)
    const file = media?.telegram_files?.find(
      (item) => item.position === Number(position)
    )
    if (!file) return fail("Media item not found.", 404)
    return await streamTelegramFile(file, request)
  } catch (error) {
    return fail(
      error instanceof MediaError
        ? error.message
        : "Saved media is unavailable.",
      error instanceof MediaError ? error.status : 503
    )
  }
}
