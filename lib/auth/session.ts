import "@/lib/server-only"
import { createHash, randomBytes } from "node:crypto"
import type { AstroCookies } from "astro"
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin/session"
import { MemoryStore } from "./memory"
import type { Principal, TelegramUser } from "./types"

export const USER_COOKIE = "tt_stats_user"
export const USER_SESSION_SECONDS = 7 * 24 * 60 * 60
export const LOGIN_COOKIE = "tt_stats_login"
export const LOGIN_SECONDS = 10 * 60
export interface LoginTransaction {
  state: string
  nonce: string
  verifier: string
  redirectUri: string
}
export const userSessions = new MemoryStore<TelegramUser>(10_000)
export const loginTransactions = new MemoryStore<LoginTransaction>(1_000)
const key = (token: string) => createHash("sha256").update(token).digest("hex")
export const randomToken = () => randomBytes(32).toString("base64url")
export function createUserSession(user: TelegramUser) {
  const token = randomToken()
  userSessions.set(key(token), user, USER_SESSION_SECONDS * 1000)
  return token
}
export function getUserSession(token?: string) {
  if (!token || !/^[\w-]{43}$/u.test(token)) return null
  return userSessions.get(key(token)) ?? null
}
export function deleteUserSession(token?: string) {
  if (token && token.length <= 256) userSessions.delete(key(token))
}
export function getPrincipal(cookies: AstroCookies): Principal {
  return {
    admin: verifyAdminSession(cookies.get(ADMIN_COOKIE)?.value),
    user: getUserSession(cookies.get(USER_COOKIE)?.value),
  }
}
export const sessionCookieOptions = (secure: boolean, maxAge: number) => ({
  path: "/",
  httpOnly: true,
  secure: secure || process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge,
})
