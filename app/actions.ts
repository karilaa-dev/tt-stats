"use server"

import { headers } from "next/headers"
import { refresh, updateTag } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { credentialsMatch } from "@/lib/auth/credentials"
import { safeNextPath } from "@/lib/auth/navigation"
import { loginRateLimiter } from "@/lib/auth/rate-limit"
import {
  createSession,
  deleteSession,
  requireSession,
} from "@/lib/auth/session"
import { getAuthEnv } from "@/lib/env"
import { STATS_CACHE_TAG } from "@/lib/stats/cache"

const loginSchema = z.object({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(4096),
})

export interface LoginActionState {
  error?: string
}

function forwardedClientKey(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for")
  const address = forwarded?.split(",")[0]?.trim()
  return address || requestHeaders.get("x-real-ip") || "unknown"
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const key = forwardedClientKey(await headers())
  const currentStatus = loginRateLimiter.status(key)
  if (currentStatus.blocked) {
    return { error: "Too many sign-in attempts. Try again later." }
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  })

  let authenticated = false
  try {
    const env = getAuthEnv()
    authenticated =
      parsed.success &&
      credentialsMatch(parsed.data.username, parsed.data.password, env)
  } catch {
    return { error: "Sign-in is temporarily unavailable." }
  }

  if (!authenticated) {
    loginRateLimiter.recordFailure(key)
    return { error: "Invalid username or password." }
  }

  loginRateLimiter.clear(key)
  await createSession()
  redirect(safeNextPath(formData.get("next")))
}

export async function logoutAction(): Promise<void> {
  await requireSession()
  await deleteSession()
  redirect("/login")
}

export async function refreshStatsAction(): Promise<void> {
  await requireSession()
  updateTag(STATS_CACHE_TAG)
  refresh()
}
