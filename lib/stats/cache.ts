import "@tanstack/react-start/server-only"

import { getStatsCacheEnv } from "@/lib/env"

interface CacheEntry {
  accessedAt: number
  hasValue: boolean
  lastAttemptAt: number
  loader: () => Promise<unknown>
  pending?: Promise<unknown>
  updatedAt: number
  value?: unknown
}

interface PeriodicStatsCacheOptions {
  maxIdleMs: number
  now?: () => number
  refreshIntervalMs: number
  startTimer?: boolean
}

export class PeriodicStatsCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly maxIdleMs: number
  private readonly now: () => number
  private readonly refreshIntervalMs: number
  private timer?: ReturnType<typeof setInterval>

  constructor({
    maxIdleMs,
    now = Date.now,
    refreshIntervalMs,
    startTimer = false,
  }: PeriodicStatsCacheOptions) {
    this.maxIdleMs = maxIdleMs
    this.now = now
    this.refreshIntervalMs = refreshIntervalMs

    if (startTimer) {
      this.timer = setInterval(() => {
        void this.refreshActive()
      }, refreshIntervalMs)
      this.timer.unref?.()
    }
  }

  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = this.now()
    let entry = this.entries.get(key)

    if (!entry) {
      entry = {
        accessedAt: now,
        hasValue: false,
        lastAttemptAt: 0,
        loader,
        updatedAt: 0,
      }
      this.entries.set(key, entry)
    } else {
      entry.accessedAt = now
      entry.loader = loader
    }

    if (!entry.hasValue) {
      return this.refreshEntry(entry) as Promise<T>
    }

    if (!entry.pending && now - entry.lastAttemptAt >= this.refreshIntervalMs) {
      void this.refreshEntry(entry).catch(logBackgroundRefreshError)
    }

    return entry.value as T
  }

  async refreshActive(force = false): Promise<void> {
    const now = this.now()
    const refreshes: Promise<unknown>[] = []

    for (const [key, entry] of this.entries) {
      if (now - entry.accessedAt > this.maxIdleMs) {
        this.entries.delete(key)
        continue
      }

      if (entry.pending) {
        refreshes.push(entry.pending.catch(logBackgroundRefreshError))
        continue
      }

      if (force || now - entry.lastAttemptAt >= this.refreshIntervalMs) {
        refreshes.push(
          this.refreshEntry(entry).catch(logBackgroundRefreshError)
        )
      }
    }

    await Promise.all(refreshes)
  }

  getLastUpdatedAt(): number | null {
    let latest = 0
    for (const entry of this.entries.values()) {
      latest = Math.max(latest, entry.updatedAt)
    }
    return latest || null
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  private refreshEntry(entry: CacheEntry): Promise<unknown> {
    if (entry.pending) return entry.pending

    entry.lastAttemptAt = this.now()
    const pending = Promise.resolve()
      .then(entry.loader)
      .then((value) => {
        entry.hasValue = true
        entry.updatedAt = this.now()
        entry.value = value
        return value
      })

    entry.pending = pending
    void pending.then(
      () => {
        if (entry.pending === pending) entry.pending = undefined
      },
      () => {
        if (entry.pending === pending) entry.pending = undefined
      }
    )
    return pending
  }
}

function logBackgroundRefreshError(): void {
  console.error("[stats-cache] background refresh failed")
}

const globalForStatsCache = globalThis as typeof globalThis & {
  ttStatsCache?: PeriodicStatsCache
}

function getStatsCache(): PeriodicStatsCache {
  if (globalForStatsCache.ttStatsCache) return globalForStatsCache.ttStatsCache

  const { STATS_CACHE_IDLE_MINUTES, STATS_REFRESH_INTERVAL_SECONDS } =
    getStatsCacheEnv()
  globalForStatsCache.ttStatsCache = new PeriodicStatsCache({
    maxIdleMs: STATS_CACHE_IDLE_MINUTES * 60 * 1000,
    refreshIntervalMs: STATS_REFRESH_INTERVAL_SECONDS * 1000,
    startTimer: true,
  })
  return globalForStatsCache.ttStatsCache
}

export function getCachedStats<T>(
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  return getStatsCache().get(key, loader)
}

export async function refreshCachedStats(): Promise<number> {
  const cache = getStatsCache()
  await cache.refreshActive(true)
  return cache.getLastUpdatedAt() ?? Date.now()
}
