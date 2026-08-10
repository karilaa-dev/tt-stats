import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getAuthEnv } from "@/lib/env"
import { sessionCookieName } from "@/lib/auth/cookie"
import {
  issueSessionToken,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "@/lib/auth/token"

export async function createSession(): Promise<void> {
  const env = getAuthEnv()
  const token = await issueSessionToken(env)
  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(sessionCookieName())
}

export const readSession = cache(async () => {
  try {
    const env = getAuthEnv()
    const token = (await cookies()).get(sessionCookieName())?.value
    return await verifySessionToken(token, env)
  } catch {
    return null
  }
})

export async function hasValidSession(): Promise<boolean> {
  return (await readSession()) !== null
}

export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) redirect("/login")
}
