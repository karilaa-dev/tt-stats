import { describe, expect, it } from "vitest"

import { credentialsMatch } from "@/lib/auth/credentials"
import { LoginRateLimiter } from "@/lib/auth/rate-limit"
import {
  issueSessionToken,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "@/lib/auth/token"
import type { AuthEnv } from "@/lib/env"

const env: AuthEnv = {
  STATS_USERNAME: "admin",
  STATS_PASSWORD: "correct horse battery staple",
  SESSION_SECRET: "01234567890123456789012345678901",
}

describe("administrator authentication", () => {
  it("accepts only the exact configured credential pair", () => {
    expect(credentialsMatch("admin", "correct horse battery staple", env)).toBe(
      true
    )
    expect(credentialsMatch("Admin", env.STATS_PASSWORD, env)).toBe(false)
    expect(credentialsMatch(env.STATS_USERNAME, "wrong", env)).toBe(false)
    expect(credentialsMatch("wrong", "wrong", env)).toBe(false)
  })

  it("expires after 12 hours and rejects tampering or credential rotation", async () => {
    const now = 1_800_000_000
    const token = await issueSessionToken(env, now)
    const valid = await verifySessionToken(
      token,
      env,
      now + SESSION_TTL_SECONDS - 1
    )
    expect(valid?.expiresAt).toBe(now + SESSION_TTL_SECONDS)
    expect(
      await verifySessionToken(token, env, now + SESSION_TTL_SECONDS + 1)
    ).toBeNull()
    expect(
      await verifySessionToken(`${token.slice(0, -1)}x`, env, now)
    ).toBeNull()
    expect(
      await verifySessionToken(
        token,
        { ...env, STATS_PASSWORD: "rotated" },
        now
      )
    ).toBeNull()
    expect(await verifySessionToken(undefined, env, now)).toBeNull()
  })
})

describe("login throttling", () => {
  it("blocks five failures per window, clears, and prunes expired entries", () => {
    const limiter = new LoginRateLimiter(5, 1_000, 2)
    for (let index = 0; index < 4; index += 1) {
      expect(limiter.recordFailure("one", 100).blocked).toBe(false)
    }
    expect(limiter.recordFailure("one", 100).blocked).toBe(true)
    expect(limiter.status("one", 1_101).blocked).toBe(false)
    limiter.recordFailure("one", 2_000)
    limiter.clear("one")
    expect(limiter.status("one", 2_000).blocked).toBe(false)
  })

  it("bounds memory by evicting the oldest entry", () => {
    const limiter = new LoginRateLimiter(1, 10_000, 2)
    limiter.recordFailure("first", 0)
    limiter.recordFailure("second", 1)
    limiter.recordFailure("third", 2)
    expect(limiter.status("first", 2).blocked).toBe(false)
    expect(limiter.status("third", 2).blocked).toBe(true)
  })
})
