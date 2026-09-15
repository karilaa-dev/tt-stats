import "@/lib/server-only"
import { randomBytes } from "node:crypto"
import type { AstroCookies } from "astro"
import { getAdminTelegramId } from "@/lib/env"
import { readSession, removeSession, saveSession } from "./store"
import type { Principal, TelegramUser } from "./types"
export { loginTransactions } from "./store"

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
export const randomToken = () => randomBytes(32).toString("base64url")
export async function createUserSession(user: TelegramUser, previous?: string) {
  const token = randomToken()
  await saveSession(token, user, USER_SESSION_SECONDS, previous)
  return token
}
export async function getUserSession(token?: string) {
  if (!token || !/^[\w-]{43}$/u.test(token)) return null
  return readSession(token)
}
export async function deleteUserSession(token?: string) {
  if (token && token.length <= 256) await removeSession(token)
}
const principals = new WeakMap<AstroCookies, Promise<Principal>>()
export function getPrincipal(cookies: AstroCookies): Promise<Principal> {
  let pending = principals.get(cookies)
  if (!pending) {
    pending = getUserSession(cookies.get(USER_COOKIE)?.value).then((user) => ({
      user,
      admin: Boolean(user && user.id === getAdminTelegramId()),
    }))
    principals.set(cookies, pending)
  }
  return pending
}
export const sessionCookieOptions = (secure: boolean, maxAge: number) => ({
  path: "/",
  httpOnly: true,
  secure: secure || process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge,
})
