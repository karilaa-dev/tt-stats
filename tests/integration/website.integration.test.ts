import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Pool } from "pg"
import {
  initializeWebsiteSchema,
  inspectWebsiteSchema,
  cleanWebsiteStorage,
} from "@/lib/db/website"
import { getPool, getAuthPool } from "@/lib/db/pool"
import {
  createUserSession,
  getUserSession,
  deleteUserSession,
  loginTransactions,
  randomToken,
  getPrincipal,
  USER_COOKIE,
} from "@/lib/auth/session"
import { hashToken } from "@/lib/auth/store"
import {
  cacheKey,
  cachedQuery,
  cachedBatch,
  readCacheBatch,
  writeCacheBatch,
  MAX_CACHE_BYTES,
} from "@/lib/db/query-cache"
import { DatabaseTask, withDatabaseTask } from "@/lib/tasks/server"
import type { AstroCookies } from "astro"

const run = process.env.RUN_DATABASE_INTEGRATION === "1"
let pool: Pool
let second: Pool
const cookies = (token: string) =>
  ({
    get: (name: string) =>
      name === USER_COOKIE ? { value: token } : undefined,
  }) as AstroCookies
describe.runIf(run)("website database storage", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DB_URL
    if (!url || !new URL(url).pathname.includes("test"))
      throw new Error("An isolated TEST_DB_URL is required")
    process.env.DB_URL = url
    process.env.TT_STATS_FAKE_DATA = "false"
    pool = new Pool({ connectionString: url, max: 2 })
    second = new Pool({ connectionString: url, max: 1 })
    await pool.query("DROP SCHEMA IF EXISTS tt_stats_web CASCADE")
  })
  afterAll(async () => {
    if (pool) {
      await pool.end()
      await second.end()
      await getPool().end()
      await getAuthPool().end()
    }
    vi.unstubAllEnvs()
  })

  it("creates missing storage concurrently and preserves existing rows and tables on restart", async () => {
    await Promise.all([
      initializeWebsiteSchema(pool),
      initializeWebsiteSchema(second),
    ])
    expect(await inspectWebsiteSchema(pool)).toBe(true)
    await pool.query(
      "INSERT INTO tt_stats_web.users(telegram_id, display_name) VALUES (77, 'Preserved')"
    )
    const before = await pool.query(
      "SELECT 'tt_stats_web.users'::regclass::oid AS oid, first_login_at FROM tt_stats_web.users WHERE telegram_id=77"
    )
    await initializeWebsiteSchema(pool)
    const after = await pool.query(
      "SELECT 'tt_stats_web.users'::regclass::oid AS oid, first_login_at FROM tt_stats_web.users WHERE telegram_id=77"
    )
    expect(after.rows).toEqual(before.rows)
    await pool.query("DROP TABLE tt_stats_web.query_cache")
    await initializeWebsiteSchema(second)
    expect(await inspectWebsiteSchema(pool)).toBe(true)
    expect(
      (
        await pool.query(
          "SELECT display_name FROM tt_stats_web.users WHERE telegram_id=77"
        )
      ).rows[0].display_name
    ).toBe("Preserved")
  })
  it("reports incompatible existing tables without replacing them", async () => {
    await pool.query(
      "ALTER TABLE tt_stats_web.users RENAME COLUMN display_name TO wrong_name"
    )
    try {
      await expect(initializeWebsiteSchema(pool)).rejects.toThrow(
        "Incompatible website tables"
      )
    } finally {
      await pool.query(
        "ALTER TABLE tt_stats_web.users RENAME COLUMN wrong_name TO display_name"
      )
    }
    expect(await inspectWebsiteSchema(pool)).toBe(true)
  })
  it("rejects incompatible cache nullability while preserving the existing definition", async () => {
    await pool.query(
      "ALTER TABLE tt_stats_web.query_cache ALTER COLUMN payload SET NOT NULL"
    )
    try {
      await expect(initializeWebsiteSchema(pool)).rejects.toThrow(
        "Incompatible website nullability"
      )
      expect(
        (
          await pool.query(
            "SELECT is_nullable FROM information_schema.columns WHERE table_schema='tt_stats_web' AND table_name='query_cache' AND column_name='payload'"
          )
        ).rows[0].is_nullable
      ).toBe("NO")
    } finally {
      await pool.query(
        "ALTER TABLE tt_stats_web.query_cache ALTER COLUMN payload DROP NOT NULL"
      )
    }
  })
  it("persists profiles and hashed sessions, rotates sessions atomically, and expires logins", async () => {
    const old = await createUserSession({
      id: "123",
      name: "Before",
      username: null,
    })
    const token = await createUserSession(
      { id: "123", name: "After", username: "new_name" },
      old
    )
    expect(await getUserSession(old)).toBeNull()
    expect(await getUserSession(token)).toEqual({
      id: "123",
      name: "After",
      username: "new_name",
    })
    const stored = await second.query(
      "SELECT token_hash, telegram_id::text FROM tt_stats_web.sessions WHERE token_hash=$1",
      [hashToken(token)]
    )
    expect(stored.rows).toEqual([
      { token_hash: hashToken(token), telegram_id: "123" },
    ])
    expect(JSON.stringify(stored.rows)).not.toContain(token)
    expect(
      (
        await pool.query(
          "SELECT count(*) FROM tt_stats_web.users WHERE telegram_id=123"
        )
      ).rows[0].count
    ).toBe("1")
    await pool.query(
      "UPDATE tt_stats_web.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [hashToken(token)]
    )
    expect(await getUserSession(token)).toBeNull()
  })
  it("shares single-use OAuth transactions and honors their expiration", async () => {
    const token = randomToken()
    const transaction = {
      state: "state",
      nonce: "nonce",
      verifier: "verifier",
      redirectUri: "https://example.test/callback",
    }
    await loginTransactions.set(token, transaction, 600000)
    const consumed = await Promise.all([
      loginTransactions.take(token),
      loginTransactions.take(token),
    ])
    expect(consumed.filter(Boolean)).toEqual([transaction])
    const expired = randomToken()
    await loginTransactions.set(expired, transaction, -1)
    expect(await loginTransactions.take(expired)).toBeUndefined()
  })
  it("resolves identity once per request and revokes admin access on logout", async () => {
    vi.stubEnv("ADMIN_TELEGRAM_ID", "123")
    const token = await createUserSession({
      id: "123",
      name: "Admin",
      username: null,
    })
    const requestCookies = cookies(token)
    const spy = vi.spyOn(getAuthPool(), "query")
    const [a, b] = await Promise.all([
      getPrincipal(requestCookies),
      getPrincipal(requestCookies),
    ])
    expect(a).toBe(b)
    expect(a.admin).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    await deleteUserSession(token)
    expect((await getPrincipal(cookies(token))).admin).toBe(false)
  })
  it("avoids source queries on hits, preserves large counts, and refreshes expired results", async () => {
    const load = vi.fn(
      async () =>
        (
          await pool.query(
            "SELECT count(*)::text AS count FROM tt_stats_web.users"
          )
        ).rows[0]
    )
    const input = { userId: "123", page: 1, sort: "newest" }
    const first = await cachedQuery("counts", input, load, pool)
    await pool.query(
      "INSERT INTO tt_stats_web.users(telegram_id, display_name) VALUES (88, 'New')"
    )
    expect(
      await cachedQuery(
        "counts",
        { sort: "newest", page: 1, userId: "123" },
        load,
        second
      )
    ).toEqual(first)
    expect(load).toHaveBeenCalledTimes(1)
    await pool.query(
      "UPDATE tt_stats_web.query_cache SET expires_at=now()-interval '1 second' WHERE cache_key=$1",
      [cacheKey("counts", input)]
    )
    expect(await cachedQuery("counts", input, load, pool)).not.toEqual(first)
    expect(load).toHaveBeenCalledTimes(2)
    const exact = { count: "9223372036854775807" }
    await cachedQuery("big", {}, async () => exact, pool)
    expect(await cachedQuery("big", {}, async () => null, second)).toEqual(
      exact
    )
  })
  it("separates accounts and every query argument", async () => {
    const input = {
      userId: "123",
      page: 1,
      pageSize: 20,
      from: 10,
      until: 20,
      sort: "newest",
      mediaKind: "all",
      discovery: "all",
      savedMediaOnly: false,
      visibility: "account",
    }
    await cachedQuery("history", input, async () => "private", pool)
    for (const change of [
      { userId: "456" },
      { page: 2 },
      { pageSize: 50 },
      { from: 0 },
      { until: 21 },
      { sort: "popular" },
      { mediaKind: "video" },
      { discovery: "first" },
      { savedMediaOnly: true },
      { visibility: "admin" },
    ]) {
      expect(
        await cachedQuery(
          "history",
          { ...input, ...change },
          async () => "different",
          pool
        )
      ).toBe("different")
    }
  })
  it("deduplicates fills across separate pools and recovers expired leases", async () => {
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return { ok: true }
    })
    const values = await Promise.all([
      cachedQuery("concurrent", {}, load, pool),
      cachedQuery("concurrent", {}, load, second),
    ])
    expect(values).toEqual([{ ok: true }, { ok: true }])
    expect(load).toHaveBeenCalledTimes(1)
    await pool.query(
      "INSERT INTO tt_stats_web.query_cache(cache_key,lease_token,lease_until) VALUES ($1,'crashed',now()-interval '1 second')",
      [cacheKey("abandoned", {})]
    )
    expect(
      await cachedQuery("abandoned", {}, async () => "recovered", pool)
    ).toBe("recovered")
  })
  it("shares overlapping comparison batches and releases failed fills", async () => {
    const calls: string[] = []
    const load = async (keys: string[]) => {
      calls.push(...keys)
      await new Promise((resolve) => setTimeout(resolve, 25))
      return new Map(keys.map((key) => [key, { count: "9223372036854775807" }]))
    }
    const [first, next] = await Promise.all([
      cachedBatch(["batch-a", "batch-b"], load, pool),
      cachedBatch(["batch-b", "batch-c"], load, second),
    ])
    expect(first.size).toBe(2)
    expect(next.size).toBe(2)
    expect(calls.sort()).toEqual(["batch-a", "batch-b", "batch-c"])
    await expect(
      cachedBatch(
        ["batch-failed"],
        async () => {
          throw new Error("failed")
        },
        pool
      )
    ).rejects.toThrow("failed")
    expect(
      (
        await pool.query(
          "SELECT payload,lease_token FROM tt_stats_web.query_cache WHERE cache_key='batch-failed'"
        )
      ).rows
    ).toEqual([{ payload: null, lease_token: null }])
  })
  it("inherits comparison expiry instead of extending freshness", async () => {
    const key = cacheKey("comparison", { userId: "123", id: "99" })
    const expires = Date.now() + 20000
    await writeCacheBatch([{ key, value: { count: "2" } }], expires, pool)
    await cachedQuery(
      "derived",
      {},
      async () => (await readCacheBatch([key], pool)).get(key)!.value,
      pool
    )
    const stored = await pool.query(
      "SELECT extract(epoch FROM expires_at)*1000 AS expires FROM tt_stats_web.query_cache WHERE cache_key=$1",
      [cacheKey("derived", {})]
    )
    expect(Number(stored.rows[0].expires)).toBeLessThanOrEqual(expires)
  })
  it("stores empty successes but never failures, cancelled results, or oversized payloads", async () => {
    await cachedQuery("empty", {}, async () => null, pool)
    expect(await cachedQuery("empty", {}, async () => "wrong", pool)).toBeNull()
    await expect(
      cachedQuery(
        "failure",
        {},
        async () => {
          throw new Error("failure")
        },
        pool
      )
    ).rejects.toThrow("failure")
    const task = new DatabaseTask()
    await expect(
      withDatabaseTask(task, () =>
        cachedQuery(
          "cancel",
          {},
          async () => {
            task.controller.abort()
            return "partial"
          },
          pool
        )
      )
    ).rejects.toThrow()
    const large = "x".repeat(MAX_CACHE_BYTES + 1)
    expect(await cachedQuery("large", {}, async () => large, pool)).toBe(large)
    const rows = await pool.query(
      "SELECT payload,lease_token FROM tt_stats_web.query_cache WHERE cache_key=ANY($1::text[])",
      [["failure", "cancel", "large"].map((kind) => cacheKey(kind, {}))]
    )
    expect(rows.rows).toEqual(
      Array(3).fill({ payload: null, lease_token: null })
    )
  })
  it("cleans expired storage in bounded batches while preserving profiles and active leases", async () => {
    await pool.query(
      "INSERT INTO tt_stats_web.query_cache(cache_key,expires_at) SELECT 'cleanup-'||n,now()-interval '1 second' FROM generate_series(1,1100) n"
    )
    await pool.query(
      "INSERT INTO tt_stats_web.query_cache(cache_key,lease_token,lease_until) VALUES ('active-cleanup','active',now()+interval '1 minute')"
    )
    await cleanWebsiteStorage(pool)
    const remaining = Number(
      (
        await pool.query(
          "SELECT count(*) FROM tt_stats_web.query_cache WHERE cache_key LIKE 'cleanup-%'"
        )
      ).rows[0].count
    )
    expect(remaining).toBeGreaterThanOrEqual(100)
    expect(remaining).toBeLessThan(1100)
    expect(
      (
        await pool.query(
          "SELECT 1 FROM tt_stats_web.query_cache WHERE cache_key='active-cleanup'"
        )
      ).rows
    ).toHaveLength(1)
    expect(
      (
        await pool.query(
          "SELECT 1 FROM tt_stats_web.users WHERE telegram_id=123"
        )
      ).rows
    ).toHaveLength(1)
  })
})
