import { afterEach, describe, expect, it, vi } from "vitest"
import type { AstroCookies } from "astro"
import { getAdminTelegramId } from "@/lib/env"
vi.mock("@/lib/auth/store", () => import("./auth-store-fixture"))
import {
  createUserSession,
  deleteUserSession,
  getPrincipal,
  USER_COOKIE,
} from "@/lib/auth/session"
const cookies = (token?: string, retired?: string) =>
  ({
    get: (name: string) =>
      name === USER_COOKIE && token
        ? { value: token }
        : name === "tt_stats_admin" && retired
          ? { value: retired }
          : undefined,
  }) as AstroCookies
afterEach(() => vi.unstubAllEnvs())
describe("Telegram administrator", () => {
  it("requires a valid server-configured Telegram ID", () => {
    expect(getAdminTelegramId({})).toBeNull()
    expect(getAdminTelegramId({ ADMIN_TELEGRAM_ID: "123" })).toBe("123")
    for (const id of ["0", "-123", "admin", "0123", "9007199254740992"])
      expect(() => getAdminTelegramId({ ADMIN_TELEGRAM_ID: id })).toThrow()
  })
  it("grants access only to a verified matching account and ignores retired cookies", async () => {
    vi.stubEnv("ADMIN_TELEGRAM_ID", "123")
    const admin = await createUserSession({
      id: "123",
      name: "Owner",
      username: null,
    })
    const other = await createUserSession({
      id: "456",
      name: "Other",
      username: null,
    })
    expect((await getPrincipal(cookies(admin))).admin).toBe(true)
    expect((await getPrincipal(cookies(other, "old-token"))).admin).toBe(false)
    expect((await getPrincipal(cookies(undefined, "old-token"))).admin).toBe(
      false
    )
    vi.stubEnv("ADMIN_TELEGRAM_ID", "456")
    expect((await getPrincipal(cookies(admin))).admin).toBe(false)
    await deleteUserSession(other)
    expect((await getPrincipal(cookies(other))).admin).toBe(false)
  })
})
