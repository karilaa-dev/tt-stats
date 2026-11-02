import { afterEach, expect, it, vi } from "vitest"
import {
  getFallbackStats,
  getScraperStatus,
  getInstagramAccounts,
  getTikTokIdentities,
} from "@/lib/scraper/queries"
const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/lib/db/pool", () => ({ query }))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})
it("only projects operational fields, never whole sessions or credentials", async () => {
  query.mockResolvedValue([])
  await getInstagramAccounts()
  await getTikTokIdentities()
  const sql = query.mock.calls.map(([sql]) => sql).join("\n")
  expect(sql).not.toMatch(
    /SELECT\s+(?:\w+\.)?\*|android_authorization|login_credentials|cookies|proxy_url/iu
  )
  expect(sql).toContain("i.session->'identity'->>'kind'")
  expect(sql).toContain("p.health->>'cooldownUntil'")
})
it("counts successful fallback separately from failed and unfinished attempts with a parameterized period", async () => {
  query.mockResolvedValue([
    {
      attempts: "6",
      successes: "3",
      appAttempts: "2",
      appSuccesses: "1",
      appFailures: "1",
      appPending: "0",
      fallbackAttempts: "4",
      fallbackSuccesses: "2",
      fallbackFailures: "1",
      fallbackPending: "1",
    },
  ])
  expect(await getFallbackStats("7d")).toMatchObject({
    appAttempts: 2,
    appSuccesses: 1,
    appFailures: 1,
    appPending: 0,
    fallbackSuccesses: 2,
    fallbackFailures: 1,
    fallbackPending: 1,
  })
  expect(query.mock.calls[0][1]).toEqual(["7 days"])
  expect(query.mock.calls[0][0]).toContain("legacy_used AND succeeded IS TRUE")
  await getFallbackStats("all")
  expect(query.mock.calls[1][1]).toEqual([null])
})
it("isolates missing Instagram tables from TikTok and never serializes raw database errors", async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('"scrap_identities"')) return []
    throw new Error("connection secret password")
  })
  const result = await getScraperStatus("24h")
  expect(result.tiktok).toEqual({ data: [], error: null })
  expect(result.instagram.data).toBeNull()
  expect(result.fallback.data).toBeNull()
  expect(JSON.stringify(result)).not.toContain("secret password")
})
