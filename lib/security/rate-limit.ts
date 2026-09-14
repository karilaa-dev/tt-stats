import "@/lib/server-only"
import type { Principal } from "@/lib/auth/types"
export const policies = {
  read: { count: 120, seconds: 60, burst: 60 },
  metadata: { count: 60, seconds: 60, burst: 20 },
  media: { count: 240, seconds: 60, burst: 60 },
  csv: { count: 5, seconds: 600, burst: 2 },
  login: { count: 10, seconds: 600, burst: 5 },
} as const
export type RateClass = keyof typeof policies
export const principalKey = (principal: Principal, ip: string) =>
  principal.user ? `user:${principal.user.id}` : `ip:${ip}`
function setting(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}
export class RateLimiter {
  private buckets = new Map<
    string,
    { tokens: number; updated: number; expires: number }
  >()
  private nextSweep = 0
  constructor(
    private now = Date.now,
    private capacity = 50_000
  ) {}
  consume(key: string, kind: RateClass): number {
    const now = this.now()
    if (now >= this.nextSweep) {
      for (const [key, value] of this.buckets)
        if (value.expires <= now) this.buckets.delete(key)
      this.nextSweep = now + 60_000
    }
    const policy = policies[kind]
    const burst = setting(
      `RATE_LIMIT_${kind.toUpperCase()}_BURST`,
      policy.burst
    )
    const rate =
      setting(`RATE_LIMIT_${kind.toUpperCase()}_COUNT`, policy.count) /
      (policy.seconds * 1000)
    const id = `${kind}:${key}`
    const previous = this.buckets.get(id)
    // Do not evict live buckets, which would let an attacker reset limits.
    if (!previous && this.buckets.size >= this.capacity) return 60
    const tokens = previous
      ? Math.min(
          burst,
          previous.tokens + Math.max(0, now - previous.updated) * rate
        )
      : burst
    this.buckets.set(id, {
      tokens: tokens >= 1 ? tokens - 1 : tokens,
      updated: now,
      expires: now + Math.max(600_000, burst / rate),
    })
    return tokens >= 1 ? 0 : Math.ceil((1 - tokens) / rate / 1000)
  }
}
export const rateLimiter = new RateLimiter()
const activeStreams = new Map<string, number>()
export function acquireStream(key: string): (() => void) | null {
  const active = activeStreams.get(key) ?? 0
  if (active >= 4 || (!active && activeStreams.size >= 10_000)) return null
  activeStreams.set(key, active + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const left = (activeStreams.get(key) ?? 1) - 1
    if (left) activeStreams.set(key, left)
    else activeStreams.delete(key)
  }
}
export function trackStream(
  response: Response,
  release: () => void,
  signal: AbortSignal
) {
  if (!response.body) {
    release()
    return response
  }
  const reader = response.body.getReader()
  let finalized = false
  const done = () => {
    if (finalized) return
    finalized = true
    release()
    signal.removeEventListener("abort", abort)
  }
  const abort = () => {
    void reader.cancel().catch(() => {})
    done()
  }
  signal.addEventListener("abort", abort, { once: true })
  if (signal.aborted) abort()
  return new Response(
    new ReadableStream({
      async pull(controller) {
        try {
          const { done: ended, value } = await reader.read()
          if (ended) {
            done()
            controller.close()
          } else controller.enqueue(value)
        } catch (error) {
          done()
          controller.error(error)
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason)
        } finally {
          done()
        }
      },
    }),
    { status: response.status, headers: response.headers }
  )
}
