import "@/lib/server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import type { Pool } from "pg"
import { getPool } from "./pool"
import { awaitForCurrentTask, MemoryLru } from "./memory-cache"
import {
  currentDatabaseTask,
  reportDatabaseProgress,
  withoutDatabaseTask,
} from "@/lib/tasks/server"

export const QUERY_CACHE_MS = 300_000
export const MAX_CACHE_BYTES = 1024 * 1024
const LEASE_MS = 150_000
// PostgreSQL remains the shared source of truth. Each process also keeps a
// bounded copy of entries it has read or written until their stored expiry, so
// repeated page loads skip the round trip and identical requests share a fill.
const LOCAL_MAX_ENTRIES = 50_000
const LOCAL_MAX_BYTES = 32 * 1024 * 1024
interface Freshness {
  expires: number
}
interface Entry<T> {
  value: T
  expires: number
}
interface LocalCache {
  values: MemoryLru<unknown>
  fills: Map<string, Promise<Entry<unknown>>>
}
const localState = globalThis as typeof globalThis & {
  ttStatsLocalQueryCache?: WeakMap<object, LocalCache>
}
const localCaches = (localState.ttStatsLocalQueryCache ??= new WeakMap())
function localCache(pool: object): LocalCache {
  let cache = localCaches.get(pool)
  if (!cache) {
    cache = {
      values: new MemoryLru(LOCAL_MAX_ENTRIES, LOCAL_MAX_BYTES),
      fills: new Map(),
    }
    localCaches.set(pool, cache)
  }
  return cache
}
/**
 * Keeps a local copy shaped exactly like a PostgreSQL JSONB read, so local and
 * shared hits are indistinguishable to callers.
 */
function remember(
  pool: object,
  key: string,
  payload: string | undefined,
  expires: number,
  stored?: unknown
) {
  if (payload === undefined) return
  const size = Buffer.byteLength(payload)
  if (size <= MAX_CACHE_BYTES)
    localCache(pool).values.set(
      key,
      stored === undefined ? JSON.parse(payload) : stored,
      expires,
      size + key.length
    )
}
/** Forget this process's copies, as a different instance would see them. */
export function clearLocalQueryCache(pool: object = getPool()) {
  localCaches.get(pool)?.values.clear()
}
const freshness = new AsyncLocalStorage<Freshness>()
const cacheEnabled = new AsyncLocalStorage<boolean>()
export const withoutQueryCache = <T>(operation: () => T) =>
  cacheEnabled.run(false, operation)
function dependOn(expires: number) {
  const parent = freshness.getStore()
  if (parent) parent.expires = Math.min(parent.expires, expires)
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)])
    )
  return value
}
export function cacheKey(kind: string, input: unknown) {
  return createHash("sha256")
    .update(JSON.stringify([1, kind, canonical(input)]))
    .digest("hex")
}
export async function readCacheBatch<T>(
  keys: string[],
  pool: Pick<Pool, "query">
): Promise<Map<string, Entry<T>>> {
  if (!keys.length || cacheEnabled.getStore() === false) return new Map()
  const entries = new Map<string, Entry<T>>()
  const local = localCache(pool).values
  const missing: string[] = []
  for (const key of keys) {
    const hit = local.get(key)
    if (hit) {
      dependOn(hit.expires)
      entries.set(key, { value: hit.value as T, expires: hit.expires })
    } else missing.push(key)
  }
  if (!missing.length) return entries
  const result = await pool.query<{
    cache_key: string
    payload: T
    expires: string
  }>(
    `SELECT cache_key, payload, (extract(epoch FROM expires_at) * 1000)::text AS expires
    FROM tt_stats_web.query_cache WHERE cache_key = ANY($1::text[]) AND computed_at IS NOT NULL AND expires_at > now()`,
    [missing]
  )
  for (const row of result.rows) {
    const expires = Number(row.expires)
    dependOn(expires)
    remember(
      pool,
      row.cache_key,
      JSON.stringify(row.payload),
      expires,
      row.payload
    )
    entries.set(row.cache_key, { value: row.payload, expires })
  }
  return entries
}
export async function writeCacheBatch<T>(
  entries: { key: string; value: T }[],
  expires: number,
  pool: Pick<Pool, "query">
) {
  if (cacheEnabled.getStore() === false) return
  dependOn(expires)
  const values = entries.filter(
    (entry) => Buffer.byteLength(JSON.stringify(entry.value)) <= MAX_CACHE_BYTES
  )
  if (!values.length || expires <= Date.now()) return
  await pool.query(
    `INSERT INTO tt_stats_web.query_cache(cache_key, payload, computed_at, expires_at)
    SELECT e.key, e.value, now(), to_timestamp($2 / 1000.0) FROM jsonb_to_recordset($1::jsonb) AS e(key text, value jsonb)
    ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at, expires_at = EXCLUDED.expires_at
    WHERE tt_stats_web.query_cache.lease_until IS NULL OR tt_stats_web.query_cache.lease_until <= now()`,
    [JSON.stringify(values), expires]
  )
  for (const entry of values)
    remember(pool, entry.key, JSON.stringify(entry.value), expires)
}
export async function cachedQuery<T>(
  kind: string,
  input: unknown,
  load: () => Promise<T>,
  pool: Pick<Pool, "query"> = getPool()
): Promise<T> {
  if (cacheEnabled.getStore() === false) return load()
  const key = cacheKey(kind, input)
  const local = localCache(pool)
  const signal = currentDatabaseTask()?.controller.signal
  for (;;) {
    signal?.throwIfAborted()
    const hit = local.values.get(key)
    if (hit) {
      dependOn(hit.expires)
      reportDatabaseProgress("Loaded saved results")
      return hit.value as T
    }
    const leader = local.fills.get(key)
    if (!leader) break
    reportDatabaseProgress("Waiting for saved results")
    try {
      const entry = await awaitForCurrentTask(leader)
      dependOn(entry.expires)
      return entry.value as T
    } catch {
      signal?.throwIfAborted()
      // The leading request failed or was cancelled. Retry with this request's
      // own lease rather than inheriting another request's outcome.
      if (local.fills.get(key) === leader) local.fills.delete(key)
    }
  }
  const fill = fillCachedQuery(key, load, pool, signal)
  local.fills.set(key, fill as Promise<Entry<unknown>>)
  try {
    const entry = await fill
    dependOn(entry.expires)
    return entry.value
  } finally {
    if (local.fills.get(key) === fill) local.fills.delete(key)
  }
}

async function fillCachedQuery<T>(
  key: string,
  load: () => Promise<T>,
  pool: Pick<Pool, "query">,
  signal: AbortSignal | undefined
): Promise<Entry<T>> {
  const token = randomUUID()
  const deadline = Date.now() + 120_000
  let attempt = 0
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    const entry = (await readCacheBatch<T>([key], pool)).get(key)
    if (entry) {
      reportDatabaseProgress("Loaded saved results")
      return entry
    }
    const claimed = await pool.query(
      `INSERT INTO tt_stats_web.query_cache(cache_key, lease_token, lease_until)
      VALUES ($1, $2, now() + $3 * interval '1 millisecond')
      ON CONFLICT (cache_key) DO UPDATE SET lease_token = EXCLUDED.lease_token, lease_until = EXCLUDED.lease_until
      WHERE (tt_stats_web.query_cache.lease_until IS NULL OR tt_stats_web.query_cache.lease_until <= now())
        AND (tt_stats_web.query_cache.expires_at IS NULL OR tt_stats_web.query_cache.expires_at <= now()) RETURNING cache_key`,
      [key, token, LEASE_MS]
    )
    if (claimed.rows.length) {
      const lifetime = { expires: Date.now() + QUERY_CACHE_MS }
      let released = false
      try {
        const value = await freshness.run(lifetime, load)
        signal?.throwIfAborted()
        const payload = JSON.stringify(value)
        if (
          payload !== undefined &&
          Buffer.byteLength(payload) <= MAX_CACHE_BYTES &&
          lifetime.expires > Date.now()
        ) {
          // Storing the result also releases the lease.
          await pool.query(
            `UPDATE tt_stats_web.query_cache SET payload = $3::jsonb, computed_at = now(), expires_at = to_timestamp($4 / 1000.0), lease_token = NULL, lease_until = NULL WHERE cache_key = $1 AND lease_token = $2`,
            [key, token, payload, lifetime.expires]
          )
          released = true
          remember(pool, key, payload, lifetime.expires)
        }
        return { value, expires: lifetime.expires }
      } finally {
        // Release with independent cancellation state so another request can retry immediately.
        if (!released)
          await withoutDatabaseTask(() =>
            pool.query(
              "UPDATE tt_stats_web.query_cache SET lease_token = NULL, lease_until = NULL WHERE cache_key = $1 AND lease_token = $2",
              [key, token]
            )
          ).catch(() => {})
      }
    }
    reportDatabaseProgress("Waiting for saved results")
    await delay(Math.min(1000, 100 * 2 ** attempt++), undefined, { signal })
  }
  throw new Error("Timed out waiting for cached query")
}

// Claim individual comparison entries together, so overlapping history filters
// share work without one database round trip per video.
export async function cachedBatch<T>(
  keys: string[],
  load: (keys: string[]) => Promise<Map<string, T>>,
  pool: Pick<Pool, "query">
): Promise<Map<string, T>> {
  keys = [...new Set(keys)]
  if (cacheEnabled.getStore() === false) return load(keys)
  const results = new Map<string, T>()
  const token = randomUUID()
  const signal = currentDatabaseTask()?.controller.signal
  const deadline = Date.now() + 120_000
  let attempt = 0
  while (results.size < keys.length) {
    signal?.throwIfAborted()
    if (Date.now() >= deadline)
      throw new Error("Timed out waiting for cached comparisons")
    let pending = keys.filter((key) => !results.has(key))
    for (const [key, entry] of await readCacheBatch<T>(pending, pool))
      results.set(key, entry.value)
    pending = pending.filter((key) => !results.has(key))
    if (!pending.length) break
    const claimed = await pool.query<{ cache_key: string }>(
      `
      INSERT INTO tt_stats_web.query_cache(cache_key, lease_token, lease_until)
      SELECT key, $2, now() + $3 * interval '1 millisecond' FROM unnest($1::text[]) AS key ORDER BY key
      ON CONFLICT (cache_key) DO UPDATE SET lease_token = EXCLUDED.lease_token, lease_until = EXCLUDED.lease_until
      WHERE (tt_stats_web.query_cache.lease_until IS NULL OR tt_stats_web.query_cache.lease_until <= now())
        AND (tt_stats_web.query_cache.expires_at IS NULL OR tt_stats_web.query_cache.expires_at <= now()) RETURNING cache_key`,
      [pending, token, LEASE_MS]
    )
    const owned = claimed.rows.map((row) => row.cache_key)
    if (owned.length) {
      const lifetime = { expires: Date.now() + QUERY_CACHE_MS }
      let unreleased = owned
      try {
        const loaded = await freshness.run(lifetime, () => load(owned))
        signal?.throwIfAborted()
        if (owned.some((key) => !loaded.has(key)))
          throw new Error("Incomplete comparison batch")
        const entries = owned
          .map((key) => {
            const value = loaded.get(key)!
            return { key, value, payload: JSON.stringify(value) }
          })
          .filter(
            (entry) => Buffer.byteLength(entry.payload) <= MAX_CACHE_BYTES
          )
        if (entries.length && lifetime.expires > Date.now()) {
          await pool.query(
            `UPDATE tt_stats_web.query_cache c SET payload = e.value, computed_at = now(), expires_at = to_timestamp($3 / 1000.0), lease_token = NULL, lease_until = NULL
            FROM jsonb_to_recordset($1::jsonb) AS e(key text, value jsonb) WHERE c.cache_key = e.key AND c.lease_token = $2`,
            [
              JSON.stringify(entries.map(({ key, value }) => ({ key, value }))),
              token,
              lifetime.expires,
            ]
          )
          const stored = new Set(entries.map((entry) => entry.key))
          unreleased = owned.filter((key) => !stored.has(key))
          for (const entry of entries)
            remember(pool, entry.key, entry.payload, lifetime.expires)
        }
        for (const key of owned) results.set(key, loaded.get(key)!)
        dependOn(lifetime.expires)
      } finally {
        // Stored entries released their leases; release the rest immediately.
        if (unreleased.length)
          await withoutDatabaseTask(() =>
            pool.query(
              "UPDATE tt_stats_web.query_cache SET lease_token = NULL, lease_until = NULL WHERE cache_key = ANY($1::text[]) AND lease_token = $2",
              [unreleased, token]
            )
          ).catch(() => {})
      }
    } else {
      await delay(Math.min(1000, 100 * 2 ** attempt++), undefined, { signal })
    }
  }
  return results
}
