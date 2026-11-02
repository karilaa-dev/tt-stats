import "@/lib/server-only"
import { query } from "@/lib/db/pool"
import { getInstagramMonitorEnv, getScraperSchema } from "@/lib/env"
import type {
  FallbackStats,
  InstagramAccount,
  ScraperRange,
  ScraperStatus,
  SourceResult,
  TikTokIdentity,
} from "./types"

export function scraperTable(
  table:
    | "scrap_instagram_accounts"
    | "scrap_instagram_attempts"
    | "scrap_identities"
    | "scrap_proxies"
) {
  return `"${getScraperSchema()}"."${table}"`
}

// Explicit projections keep credentials, cookies, proxy URLs and device sessions
// out of both the query results and the browser payload.
export async function getInstagramAccounts(): Promise<InstagramAccount[]> {
  return query<InstagramAccount>(`SELECT id, username, user_id AS "userId",
    CASE WHEN dead THEN 'dead' WHEN cooldown_until > now() THEN 'cooldown' ELSE 'available' END AS status,
    dead_reason AS "deadReason", dead_at::text AS "deadAt", cooldown_until::text AS "cooldownUntil"
    FROM ${scraperTable("scrap_instagram_accounts")} ORDER BY dead DESC, ordinal`)
}
export async function getTikTokIdentities(): Promise<TikTokIdentity[]> {
  return query<TikTokIdentity>(`SELECT i.id::text, i.proxy_id::text AS "proxyId",
    i.session->'identity'->>'kind' AS kind,
    CASE WHEN greatest(coalesce((i.health->>'cooldownUntil')::bigint, 0), coalesce((p.health->>'cooldownUntil')::bigint, 0)) > extract(epoch FROM now()) * 1000 THEN 'cooldown' ELSE 'available' END AS status,
    i.assignment_count::text AS assignments, coalesce((i.health->>'failures')::int, 0) AS failures,
    i.health->>'lastFailureCode' AS "lastFailure", p.health->>'lastFailureCode' AS "proxyFailure",
    CASE WHEN greatest(coalesce((i.health->>'cooldownUntil')::bigint, 0), coalesce((p.health->>'cooldownUntil')::bigint, 0)) > 0
      THEN to_timestamp(greatest(coalesce((i.health->>'cooldownUntil')::bigint, 0), coalesce((p.health->>'cooldownUntil')::bigint, 0)) / 1000.0)::text END AS "cooldownUntil",
    i.last_used_at::text AS "lastUsedAt", i.updated_at::text AS "updatedAt"
    FROM ${scraperTable("scrap_identities")} i JOIN ${scraperTable("scrap_proxies")} p ON p.id = i.proxy_id
    ORDER BY i.proxy_id, i.ordinal`)
}
export async function getFallbackStats(
  range: ScraperRange
): Promise<FallbackStats> {
  const interval = {
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
    all: null,
  }[range]
  const [row] = await query<Record<keyof FallbackStats, string>>(
    `SELECT count(*)::text AS attempts,
    count(*) FILTER (WHERE succeeded IS TRUE)::text AS successes,
    count(*) FILTER (WHERE legacy_used)::text AS "fallbackAttempts",
    count(*) FILTER (WHERE legacy_used AND succeeded IS TRUE)::text AS "fallbackSuccesses",
    count(*) FILTER (WHERE legacy_used AND succeeded IS FALSE)::text AS "fallbackFailures",
    count(*) FILTER (WHERE legacy_used AND succeeded IS NULL)::text AS "fallbackPending"
    FROM ${scraperTable("scrap_instagram_attempts")}
    WHERE ($1::interval IS NULL OR created_at >= now() - $1::interval)`,
    [interval]
  )
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)])
  ) as unknown as FallbackStats
}
async function source<T>(load: () => Promise<T>): Promise<SourceResult<T>> {
  try {
    return { data: await load(), error: null }
  } catch {
    return {
      data: null,
      error:
        "Could not read tt-scrap data. Check the database connection, SCRAP_DB_SCHEMA, table versions, and SELECT permissions, then refresh.",
    }
  }
}
export async function getScraperStatus(
  range: ScraperRange
): Promise<ScraperStatus> {
  const [instagram, tiktok, fallback] = await Promise.all([
    source(getInstagramAccounts),
    source(getTikTokIdentities),
    source(() => getFallbackStats(range)),
  ])
  let notifications: ScraperStatus["notifications"]
  try {
    notifications = getInstagramMonitorEnv() ? "configured" : "disabled"
  } catch {
    notifications = "invalid"
  }
  return {
    checkedAt: new Date().toISOString(),
    instagram,
    tiktok,
    fallback,
    notifications,
  }
}
