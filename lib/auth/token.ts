import { jwtVerify, SignJWT } from "jose"

import type { AuthEnv } from "@/lib/env"
import { credentialVersion, usernameSubject } from "@/lib/auth/crypto"

export const SESSION_TTL_SECONDS = 12 * 60 * 60

export interface SessionPayload {
  sub: string
  authVersion: string
  issuedAt: number
  expiresAt: number
}

function signingKey(env: AuthEnv): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET)
}

export async function issueSessionToken(
  env: AuthEnv,
  nowEpoch = Math.floor(Date.now() / 1000)
): Promise<string> {
  const expiresAt = nowEpoch + SESSION_TTL_SECONDS
  const authVersion = credentialVersion(
    env.SESSION_SECRET,
    env.STATS_USERNAME,
    env.STATS_PASSWORD
  )

  return new SignJWT({ authVersion, issuedAt: nowEpoch, expiresAt })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(usernameSubject(env.STATS_USERNAME))
    .setIssuedAt(nowEpoch)
    .setExpirationTime(expiresAt)
    .sign(signingKey(env))
}

export async function verifySessionToken(
  token: string | undefined,
  env: AuthEnv,
  nowEpoch = Math.floor(Date.now() / 1000)
): Promise<SessionPayload | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, signingKey(env), {
      algorithms: ["HS256"],
      currentDate: new Date(nowEpoch * 1000),
    })
    const expectedVersion = credentialVersion(
      env.SESSION_SECRET,
      env.STATS_USERNAME,
      env.STATS_PASSWORD
    )
    const expectedSubject = usernameSubject(env.STATS_USERNAME)

    if (
      payload.sub !== expectedSubject ||
      payload.authVersion !== expectedVersion ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.exp !== payload.expiresAt ||
      payload.iat !== payload.issuedAt
    ) {
      return null
    }

    return {
      sub: payload.sub,
      authVersion: payload.authVersion,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}
