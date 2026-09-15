import type { APIRoute } from "astro"
import { finishTelegramLogin } from "@/lib/auth/telegram"
import { telegramLoginFailureDetails } from "@/lib/auth/diagnostics"
import {
  LOGIN_COOKIE,
  USER_COOKIE,
  USER_SESSION_SECONDS,
  loginTransactions,
  createUserSession,
  sessionCookieOptions,
} from "@/lib/auth/session"
export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  const token = cookies.get(LOGIN_COOKIE)?.value
  cookies.delete(LOGIN_COOKIE, { path: "/" })
  try {
    const transaction = token ? await loginTransactions.take(token) : undefined
    if (
      !transaction ||
      url.searchParams.getAll("state").length !== 1 ||
      url.searchParams.get("state") !== transaction.state
    )
      return redirect("/dashboard/me?login=expired", 303)
    if (url.searchParams.has("error"))
      return redirect("/dashboard/me?login=cancelled", 303)
    const user = await finishTelegramLogin(url, transaction)
    const session = await createUserSession(
      user,
      cookies.get(USER_COOKIE)?.value
    )
    cookies.set(
      USER_COOKIE,
      session,
      sessionCookieOptions(url.protocol === "https:", USER_SESSION_SECONDS)
    )
    return redirect("/dashboard/me", 303)
  } catch (error) {
    console.error(
      "[telegram-login] callback failed",
      telegramLoginFailureDetails(error)
    )
    return redirect("/dashboard/me?login=failed", 303)
  }
}
