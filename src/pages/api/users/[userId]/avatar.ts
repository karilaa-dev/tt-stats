import type { APIRoute } from "astro"
import { getPrincipal } from "@/lib/auth/session"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { parseTelegramId } from "@/lib/stats/validation"
import { getTelegramAvatar } from "@/lib/telegram/avatar"

export const HEAD: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: "GET" } })

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const userId = parseTelegramId(params.userId)
  const principal = await getPrincipal(cookies)
  if (
    !userId ||
    (!principal.admin && principal.user?.id !== userId) ||
    isFakeDataEnabled()
  ) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    })
  }
  return getTelegramAvatar(userId, request)
}
