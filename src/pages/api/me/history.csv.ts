import type { APIRoute } from "astro"
import { getHistoryCsvResponse } from "@/lib/csv/history"
import { getPrincipal } from "@/lib/auth/session"
export const GET: APIRoute = async ({ cookies }) => {
  const user = (await getPrincipal(cookies)).user
  if (!user)
    return Response.json(
      { message: "Log in with Telegram to continue." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  return getHistoryCsvResponse(user.id)
}
