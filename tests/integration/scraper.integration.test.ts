import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Pool } from "pg"
import { initializeWebsiteSchema } from "@/lib/db/website"
import { getPool } from "@/lib/db/pool"
import {
  getFallbackStats,
  getInstagramAccounts,
  getTikTokIdentities,
} from "@/lib/scraper/queries"
import { checkDeadInstagramAccounts } from "@/lib/notifications/instagram-dead"

let pool: Pool
const env = { provider: "ntfy" as const, url: "https://ntfy.example/test" }
// Operational columns from tt-scrap/internal/{identity/pool,instagramapp/store}.go.
// Credentials below are sentinels: none may reach the read models.
describe.runIf(process.env.RUN_DATABASE_INTEGRATION === "1")(
  "tt-scrap source tables",
  () => {
    beforeAll(async () => {
      const url = process.env.TEST_DB_URL
      if (!url || !new URL(url).pathname.includes("test"))
        throw new Error("An isolated TEST_DB_URL is required")
      vi.stubEnv("DB_URL", url)
      vi.stubEnv("SCRAP_DB_SCHEMA", "scraper_accounts_test")
      vi.stubEnv("TT_STATS_FAKE_DATA", "false")
      pool = new Pool({ connectionString: url })
      await initializeWebsiteSchema(pool)
      await pool.query(`DROP SCHEMA IF EXISTS scraper_accounts_test CASCADE;
      CREATE SCHEMA scraper_accounts_test;
      CREATE TABLE scraper_accounts_test.scrap_instagram_accounts (
        id text PRIMARY KEY, ordinal bigserial, username text, user_id text,
        dead boolean NOT NULL DEFAULT false, dead_reason text, dead_at timestamptz, cooldown_until timestamptz,
        android_authorization text DEFAULT 'CREDENTIAL_SENTINEL');
      CREATE TABLE scraper_accounts_test.scrap_instagram_attempts (
        id bigserial PRIMARY KEY, source_id text DEFAULT 'post', legacy_used boolean NOT NULL,
        succeeded boolean, created_at timestamptz DEFAULT now(), finished_at timestamptz);
      CREATE TABLE scraper_accounts_test.scrap_proxies (id bigint PRIMARY KEY, health jsonb, proxy_url text DEFAULT 'CREDENTIAL_SENTINEL');
      CREATE TABLE scraper_accounts_test.scrap_identities (
        id uuid PRIMARY KEY, proxy_id bigint, ordinal smallint, session jsonb,
        assignment_count bigint, health jsonb, last_used_at timestamptz, updated_at timestamptz DEFAULT now());
      INSERT INTO scraper_accounts_test.scrap_instagram_accounts(id, username, dead, dead_reason, dead_at)
        VALUES ('ig1', 'alice', true, 'login_required', now()), ('ig2', 'bob', false, NULL, NULL);
      UPDATE scraper_accounts_test.scrap_instagram_accounts SET cooldown_until = now() + interval '1 hour' WHERE id = 'ig2';
      INSERT INTO scraper_accounts_test.scrap_proxies VALUES (1, jsonb_build_object('cooldownUntil', (extract(epoch FROM now()) * 1000)::bigint + 3600000), 'CREDENTIAL_SENTINEL');
      INSERT INTO scraper_accounts_test.scrap_identities (id, proxy_id, ordinal, session, assignment_count, health)
        VALUES ('11111111-1111-1111-1111-111111111111', 1, 0, '{"identity":{"kind":"registered"},"cookie":"CREDENTIAL_SENTINEL"}', 9007199254740993, '{}');
      INSERT INTO scraper_accounts_test.scrap_instagram_attempts(legacy_used,succeeded,created_at)
        VALUES (true, true, now()), (true, false, now()), (true, NULL, now()), (false, true, now()), (false, false, now()), (true, true, now() - interval '2 days');
      DELETE FROM tt_stats_web.instagram_dead_notifications WHERE source_schema = 'scraper_accounts_test';`)
    })
    afterAll(async () => {
      if (pool) {
        await pool.query("DROP SCHEMA scraper_accounts_test CASCADE")
        await pool.end()
        await getPool().end()
      }
      vi.unstubAllEnvs()
    })
    it("reads source states including proxy cooldown without disclosing credentials", async () => {
      const accounts = await getInstagramAccounts()
      const identities = await getTikTokIdentities()
      expect(accounts.map((a) => a.status)).toEqual(["dead", "cooldown"])
      expect(identities[0]).toMatchObject({
        status: "cooldown",
        assignments: "9007199254740993",
        kind: "registered",
      })
      expect(JSON.stringify({ accounts, identities })).not.toContain(
        "CREDENTIAL_SENTINEL"
      )
    })
    it("counts fallback successes and distinguishes failures and unfinished attempts in each window", async () => {
      expect(await getFallbackStats("24h")).toEqual({
        attempts: 5,
        successes: 2,
        fallbackAttempts: 3,
        fallbackSuccesses: 1,
        fallbackFailures: 1,
        fallbackPending: 1,
      })
      expect(await getFallbackStats("7d")).toMatchObject({
        fallbackSuccesses: 2,
        successes: 3,
      })
      expect(await getFallbackStats("all")).toMatchObject({ attempts: 6 })
    })
    it("deduplicates across instances and rearms after recovery or a new death timestamp", async () => {
      const fetcher = vi.fn(async () => new Response(null, { status: 200 }))
      await Promise.all([
        checkDeadInstagramAccounts({ pool, env, fetcher }),
        checkDeadInstagramAccounts({ pool, env, fetcher }),
      ])
      expect(fetcher).toHaveBeenCalledOnce()
      expect(await checkDeadInstagramAccounts({ pool, env, fetcher })).toBe(
        "idle"
      )
      await pool.query(
        "UPDATE scraper_accounts_test.scrap_instagram_accounts SET dead_at = dead_at + interval '1 second' WHERE id='ig1'"
      )
      expect(await checkDeadInstagramAccounts({ pool, env, fetcher })).toBe(
        "sent"
      )
      await pool.query(
        "UPDATE scraper_accounts_test.scrap_instagram_accounts SET dead = false WHERE id='ig1'"
      )
      expect(await checkDeadInstagramAccounts({ pool, env, fetcher })).toBe(
        "idle"
      )
      await pool.query(
        "UPDATE scraper_accounts_test.scrap_instagram_accounts SET dead = true, dead_at = NULL WHERE id='ig1'"
      )
      expect(await checkDeadInstagramAccounts({ pool, env, fetcher })).toBe(
        "sent"
      )
      expect(await checkDeadInstagramAccounts({ pool, env, fetcher })).toBe(
        "idle"
      )
      expect(fetcher).toHaveBeenCalledTimes(3)
    })
    it("rolls back failed sends, retries them, and leaves source tables untouched", async () => {
      await pool.query(
        "UPDATE scraper_accounts_test.scrap_instagram_accounts SET dead = true, dead_at = now() WHERE id='ig2'"
      )
      const before = await pool.query(
        "SELECT * FROM scraper_accounts_test.scrap_instagram_accounts ORDER BY id"
      )
      await expect(
        checkDeadInstagramAccounts({
          pool,
          env,
          fetcher: async () => new Response(null, { status: 503 }),
        })
      ).rejects.toThrow("HTTP 503")
      expect(
        (
          await pool.query(
            "SELECT * FROM tt_stats_web.instagram_dead_notifications WHERE account_id='ig2' AND source_schema='scraper_accounts_test'"
          )
        ).rows
      ).toEqual([])
      expect(
        await checkDeadInstagramAccounts({
          pool,
          env,
          fetcher: async () => new Response(null, { status: 200 }),
        })
      ).toBe("sent")
      expect(
        (
          await pool.query(
            "SELECT * FROM scraper_accounts_test.scrap_instagram_accounts ORDER BY id"
          )
        ).rows
      ).toEqual(before.rows)
    })
  }
)
