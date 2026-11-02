import type { ScraperStatus } from "./types"
export function fakeScraperStatus(): ScraperStatus {
  return {
    checkedAt: new Date().toISOString(),
    notifications: "demo",
    instagram: {
      error: null,
      data: [
        {
          id: "demo-instagram-1",
          username: "demo_account",
          userId: "1001",
          status: "available",
          deadReason: null,
          deadAt: null,
          cooldownUntil: null,
        },
        {
          id: "demo-instagram-2",
          username: "demo_disabled",
          userId: "1002",
          status: "dead",
          deadReason: "login_required",
          deadAt: "2026-11-01T12:00:00Z",
          cooldownUntil: null,
        },
      ],
    },
    tiktok: {
      error: null,
      data: [
        {
          id: "demo-tiktok-1",
          proxyId: "1",
          kind: "registered",
          status: "available",
          assignments: "142",
          failures: 0,
          lastFailure: null,
          proxyFailure: null,
          cooldownUntil: null,
          lastUsedAt: "2026-11-01T12:00:00Z",
          updatedAt: "2026-11-01T12:00:00Z",
        },
      ],
    },
    fallback: {
      error: null,
      data: {
        attempts: 150,
        successes: 120,
        fallbackAttempts: 30,
        fallbackSuccesses: 20,
        fallbackFailures: 8,
        fallbackPending: 2,
      },
    },
  }
}
