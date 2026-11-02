import { afterEach, describe, expect, it, vi } from "vitest"
import type { Pool } from "pg"
import { getInstagramMonitorEnv, getScraperSchema } from "@/lib/env"
import {
  checkDeadInstagramAccounts,
  deliverDeadAccounts,
} from "@/lib/notifications/instagram-dead"

const env = {
  provider: "ntfy" as const,
  url: "https://ntfy.example/topic",
  token: "test-secret",
}
const account = {
  id: "ig-1",
  username: "alice",
  reason: "login_required",
  incident: "2026-11-02 10:00:00+00",
}
afterEach(() => vi.unstubAllEnvs())

describe("Instagram alerts", () => {
  it("reuses ntfy but keeps dedicated credentials separate", () => {
    expect(getInstagramMonitorEnv({})).toBeNull()
    expect(
      getInstagramMonitorEnv({
        VIDEO_INACTIVITY_NTFY_URL: env.url,
        VIDEO_INACTIVITY_NTFY_TOKEN: env.token,
      })
    ).toEqual(env)
    expect(
      getInstagramMonitorEnv({
        VIDEO_INACTIVITY_NTFY_URL: env.url,
        VIDEO_INACTIVITY_NTFY_TOKEN: env.token,
        INSTAGRAM_DEAD_NTFY_URL: "https://other.example/topic",
      })
    ).toEqual({
      provider: "ntfy",
      url: "https://other.example/topic",
      token: undefined,
    })
    expect(() =>
      getInstagramMonitorEnv({ INSTAGRAM_DEAD_NTFY_TOKEN: "orphan" })
    ).toThrow()
    expect(() =>
      getInstagramMonitorEnv({ INSTAGRAM_DEAD_NTFY_URL: "file:///tmp/topic" })
    ).toThrow()
    expect(() =>
      getScraperSchema({ SCRAP_DB_SCHEMA: 'public"; drop schema public' })
    ).toThrow()
    expect(getScraperSchema({})).toBe("public")
  })
  it("uses bounded UTF-8 bodies and never puts usernames in HTTP headers", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }))
    await deliverDeadAccounts(
      Array.from({ length: 25 }, () => ({
        ...account,
        username: "😀".repeat(100),
      })),
      env,
      fetcher
    )
    const init = (
      fetcher.mock.calls as unknown as [string, RequestInit][]
    )[0][1]
    expect(new TextEncoder().encode(String(init.body)).length).toBeLessThan(
      4096
    )
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-secret",
      Priority: "high",
      Title: "Instagram accounts need attention",
    })
    expect(init.redirect).toBe("error")
  })
  it("does not record an incident when delivery fails, allowing retry", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("pg_try_advisory")) return { rows: [{ acquired: true }] }
      if (sql.includes("SELECT a.id")) return { rows: [account] }
      return { rows: [] }
    })
    const release = vi.fn()
    const pool = {
      connect: async () => ({ query, release }),
    } as unknown as Pool
    await expect(
      checkDeadInstagramAccounts({
        pool,
        env,
        fetcher: async () => new Response("private response", { status: 500 }),
      })
    ).rejects.toThrow("HTTP 500")
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(
      false
    )
    expect(query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false)
    expect(release).toHaveBeenCalledWith(true)
  })
  it("skips another instance's check and makes no source read or send", async () => {
    const query = vi.fn(async () => ({ rows: [{ acquired: false }] }))
    const fetcher = vi.fn()
    expect(
      await checkDeadInstagramAccounts({
        pool: {
          connect: async () => ({ query, release: vi.fn() }),
        } as unknown as Pool,
        env,
        fetcher,
      })
    ).toBe("locked")
    expect(fetcher).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(3)
  })
  it("does not connect or notify in demo mode or when disabled", async () => {
    const connect = vi.fn()
    const pool = { connect } as unknown as Pool
    expect(await checkDeadInstagramAccounts({ pool, env: null })).toBe(
      "disabled"
    )
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("TT_STATS_FAKE_DATA", "true")
    expect(await checkDeadInstagramAccounts({ pool, env })).toBe("disabled")
    expect(connect).not.toHaveBeenCalled()
  })
})
