import type { APIRoute } from "astro"
import {
  getPrincipal,
  USER_COOKIE,
  deleteUserSession,
  LOGIN_COOKIE,
  loginTransactions,
} from "@/lib/auth/session"
import { getOAuthEnv } from "@/lib/auth/telegram"
const headers = { "Cache-Control": "no-store" }
export const GET: APIRoute = async ({ cookies }) =>
  Response.json(
    {
      ...(await getPrincipal(cookies)),
      loginAvailable: Boolean(getOAuthEnv()),
    },
    { headers }
  )
export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  if (request.headers.get("origin") !== url.origin)
    return new Response(null, { status: 403, headers })
  await deleteUserSession(cookies.get(USER_COOKIE)?.value)
  const login = cookies.get(LOGIN_COOKIE)?.value
  if (login) await loginTransactions.delete(login)
  cookies.delete(USER_COOKIE, { path: "/" })
  cookies.delete(LOGIN_COOKIE, { path: "/" })
  return Response.json({ user: null }, { headers })
}
