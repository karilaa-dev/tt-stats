export type ScraperRange = "24h" | "7d" | "30d" | "all"
export interface InstagramAccount {
  id: string
  username: string | null
  userId: string | null
  status: "dead" | "cooldown" | "available"
  deadReason: string | null
  deadAt: string | null
  cooldownUntil: string | null
}
export interface TikTokIdentity {
  id: string
  proxyId: string
  kind: string | null
  status: "cooldown" | "available"
  assignments: string
  failures: number
  lastFailure: string | null
  proxyFailure: string | null
  cooldownUntil: string | null
  lastUsedAt: string | null
  updatedAt: string
}
export interface FallbackStats {
  attempts: number
  successes: number
  fallbackAttempts: number
  fallbackSuccesses: number
  fallbackFailures: number
  fallbackPending: number
}
export type SourceResult<T> =
  { data: T; error: null } | { data: null; error: string }
export interface ScraperStatus {
  checkedAt: string
  instagram: SourceResult<InstagramAccount[]>
  tiktok: SourceResult<TikTokIdentity[]>
  fallback: SourceResult<FallbackStats>
  notifications: "configured" | "disabled" | "invalid" | "demo"
}
