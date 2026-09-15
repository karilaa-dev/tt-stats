import type { APIRoute } from "astro"
import { beginTelegramLogin } from "@/lib/auth/telegram"
import {
  LOGIN_COOKIE,
  LOGIN_SECONDS,
  loginTransactions,
  randomToken,
  sessionCookieOptions,
} from "@/lib/auth/session"
export const GET: APIRoute = async ({ cookies, url, redirect, request }) => {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return new Response(null, { status: 403 })
  try {
    const previous = cookies.get(LOGIN_COOKIE)?.value
    if (previous) await loginTransactions.delete(previous)
    const { url: loginUrl, transaction } = await beginTelegramLogin()
    const token = randomToken()
    await loginTransactions.set(token, transaction, LOGIN_SECONDS * 1000)
    cookies.set(
      LOGIN_COOKIE,
      token,
      sessionCookieOptions(url.protocol === "https:", LOGIN_SECONDS)
    )
    return redirect(loginUrl.href, 303)
  } catch {
    return redirect("/dashboard/me?login=unavailable", 303)
  }
}
