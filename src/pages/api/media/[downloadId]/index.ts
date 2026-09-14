import type { APIRoute } from "astro"
import { getPrincipal } from "@/lib/auth/session"
import { canReadMedia } from "@/lib/media/access"
import { getStoredMedia } from "@/lib/media/queries"
import { describeMedia } from "@/lib/media/telegram"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getSafeDatabaseError } from "@/lib/db/errors"
export const GET: APIRoute = async ({ params, cookies }) => {
  const id = params.downloadId ?? ""
  const headers = { "Cache-Control": "private, no-store" }
  if (!/^[1-9]\d{0,18}$/u.test(id) || BigInt(id) > 9223372036854775807n)
    return Response.json(
      { message: "Invalid media request." },
      { status: 400, headers }
    )
  try {
    if (!(await canReadMedia(getPrincipal(cookies), id)))
      return Response.json(
        { message: "Saved media is unavailable." },
        { status: 404, headers }
      )
    return Response.json(
      isFakeDataEnabled()
        ? {
            items: [],
            unavailableReason: "Saved media is unavailable in demo mode.",
          }
        : describeMedia(id, await getStoredMedia(id)),
      { headers }
    )
  } catch (error) {
    console.error("[media] metadata unavailable", {
      kind: getSafeDatabaseError(error).kind,
    })
    return Response.json(
      { message: "Saved media is temporarily unavailable." },
      { status: 503, headers }
    )
  }
}
