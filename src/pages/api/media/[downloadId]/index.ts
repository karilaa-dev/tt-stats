import type { APIRoute } from "astro"
import { getPrincipal } from "@/lib/auth/session"
import { canReadMedia } from "@/lib/media/access"
import { getStoredMedia } from "@/lib/media/queries"
import { describeMedia } from "@/lib/media/telegram"
import { parseMediaIdParam } from "@/lib/media/ids"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getSafeDatabaseError } from "@/lib/db/errors"
export const GET: APIRoute = async ({ params, cookies }) => {
  const media = parseMediaIdParam(params.downloadId)
  const id = media ? `${media.kind === "audio" ? "audio:" : ""}${media.id}` : ""
  const headers = { "Cache-Control": "private, no-store" }
  if (!media)
    return Response.json(
      { message: "Invalid media request." },
      { status: 400, headers }
    )
  try {
    if (!(await canReadMedia(await getPrincipal(cookies), id)))
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
