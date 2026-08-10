export interface RateLimitStatus {
  blocked: boolean
  retryAfterSeconds: number
}

interface AttemptWindow {
  failures: number
  resetsAt: number
}

export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>()

  constructor(
    private readonly maximumFailures = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly maximumEntries = 10_000
  ) {}

  status(key: string, now = Date.now()): RateLimitStatus {
    this.prune(now)
    const attempt = this.attempts.get(key)
    if (!attempt || attempt.resetsAt <= now) {
      this.attempts.delete(key)
      return { blocked: false, retryAfterSeconds: 0 }
    }

    const blocked = attempt.failures >= this.maximumFailures
    return {
      blocked,
      retryAfterSeconds: blocked
        ? Math.max(1, Math.ceil((attempt.resetsAt - now) / 1000))
        : 0,
    }
  }

  recordFailure(key: string, now = Date.now()): RateLimitStatus {
    this.prune(now)
    const previous = this.attempts.get(key)
    const next =
      previous && previous.resetsAt > now
        ? { ...previous, failures: previous.failures + 1 }
        : { failures: 1, resetsAt: now + this.windowMs }

    if (!this.attempts.has(key) && this.attempts.size >= this.maximumEntries) {
      const oldestKey = this.attempts.keys().next().value as string | undefined
      if (oldestKey) this.attempts.delete(oldestKey)
    }
    this.attempts.set(key, next)
    return this.status(key, now)
  }

  clear(key: string): void {
    this.attempts.delete(key)
  }

  private prune(now: number): void {
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetsAt <= now) this.attempts.delete(key)
    }
  }
}

const globalForRateLimit = globalThis as typeof globalThis & {
  ttStatsLoginRateLimiter?: LoginRateLimiter
}

export const loginRateLimiter =
  globalForRateLimit.ttStatsLoginRateLimiter ?? new LoginRateLimiter()

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.ttStatsLoginRateLimiter = loginRateLimiter
}
