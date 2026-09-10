import "@/lib/server-only"
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

export const ADMIN_COOKIE = "tt_stats_admin"
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60

export function getAdminToken(source: NodeJS.ProcessEnv = process.env) {
  const token = source.ADMIN_TOKEN
  return token && token.trim().length >= 32 ? token : null
}

function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  )
}

export function verifyAdminToken(candidate: string, secret = getAdminToken()) {
  return secret !== null && equal(candidate, secret)
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`admin-session:${payload}`)
    .digest("base64url")
}

export function createAdminSession(secret: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + ADMIN_SESSION_SECONDS}.${randomBytes(24).toString("base64url")}`
  return `${payload}.${sign(payload, secret)}`
}

export function verifyAdminSession(
  value: string | undefined,
  secret = getAdminToken(),
  now = Date.now()
) {
  if (!value || !secret || value.length > 256) return false
  const parts = value.split(".")
  if (parts.length !== 3 || !/^\d+$/u.test(parts[0])) return false
  const expires = Number(parts[0])
  const current = Math.floor(now / 1000)
  if (expires <= current || expires > current + ADMIN_SESSION_SECONDS)
    return false
  return equal(parts[2], sign(`${parts[0]}.${parts[1]}`, secret))
}
