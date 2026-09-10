import { describe, expect, it } from "vitest"
import {
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  getAdminToken,
  verifyAdminSession,
  verifyAdminToken,
} from "@/lib/admin/session"

const secret = "test-admin-secret-with-at-least-32-characters"
describe("shared admin sessions", () => {
  it("fails closed when the secret is missing or short", () => {
    expect(getAdminToken({})).toBeNull()
    expect(getAdminToken({ ADMIN_TOKEN: "short" })).toBeNull()
    expect(verifyAdminToken(secret, null)).toBe(false)
    expect(verifyAdminSession(createAdminSession(secret), null)).toBe(false)
  })
  it("accepts only the configured token", () => {
    expect(verifyAdminToken(secret, secret)).toBe(true)
    expect(verifyAdminToken("wrong", secret)).toBe(false)
  })
  it("rejects tampering, expiry and secret rotation", () => {
    const now = 1_800_000_000_000
    const session = createAdminSession(secret, now)
    expect(session).not.toContain(secret)
    expect(verifyAdminSession(session, secret, now)).toBe(true)
    expect(verifyAdminSession(session + "x", secret, now)).toBe(false)
    expect(
      verifyAdminSession(session.replace(/^\d+/u, "9999999999"), secret, now)
    ).toBe(false)
    expect(
      verifyAdminSession(session, secret, now + ADMIN_SESSION_SECONDS * 1000)
    ).toBe(false)
    expect(
      verifyAdminSession(
        session,
        "a-different-admin-secret-of-sufficient-length",
        now
      )
    ).toBe(false)
    for (const bad of [undefined, "", "x.y.z", "123", secret])
      expect(verifyAdminSession(bad, secret, now)).toBe(false)
  })
})
