import { afterEach, describe, expect, it, vi } from "vitest"
import {
  RateLimiter,
  acquireStream,
  principalKey,
  trackStream,
} from "@/lib/security/rate-limit"
import { safeExternalUrl } from "@/lib/security/links"
import { requestWithCooldown, clearCooldowns } from "@/lib/http-client"
afterEach(() => {
  vi.unstubAllEnvs()
  clearCooldowns()
})
describe("rate limits", () => {
  it("allows normal reads, limits bursts, refills tokens, and separates users", () => {
    let now = 0
    const limiter = new RateLimiter(() => now)
    for (let i = 0; i < 60; i++)
      expect(limiter.consume("user:1", "read")).toBe(0)
    expect(limiter.consume("user:1", "read")).toBe(1)
    expect(limiter.consume("user:2", "read")).toBe(0)
    expect(limiter.consume("user:1", "media")).toBe(0)
    now = 500
    expect(limiter.consume("user:1", "read")).toBe(0)
  })
  it("keys all sessions of an account together, and anonymous users by IP", () => {
    const principal = {
      user: { id: "123", name: "User", username: null },
      admin: false,
    }
    expect(principalKey(principal, "1.2.3.4")).toBe(
      principalKey(principal, "5.6.7.8")
    )
    expect(principalKey({ user: null, admin: false }, "1.2.3.4")).toBe(
      "ip:1.2.3.4"
    )
  })
  it("does not evict blocked accounts when its memory fills", () => {
    const limiter = new RateLimiter(() => 0, 1)
    expect(limiter.consume("user:1", "csv")).toBe(0)
    expect(limiter.consume("user:1", "csv")).toBe(0)
    expect(limiter.consume("user:2", "csv")).toBe(60)
    expect(limiter.consume("user:1", "csv")).toBe(120)
  })
  it("respects server overrides", () => {
    vi.stubEnv("RATE_LIMIT_READ_BURST", "1")
    vi.stubEnv("RATE_LIMIT_READ_COUNT", "1")
    const limiter = new RateLimiter(() => 0)
    expect(limiter.consume("user:1", "read")).toBe(0)
    expect(limiter.consume("user:1", "read")).toBe(60)
  })
  it("blocks parallel stream abuse and releases only once", () => {
    const releases = Array.from({ length: 4 }, () =>
      acquireStream("test:parallel")!
    )
    expect(acquireStream("test:parallel")).toBeNull()
    releases[0]()
    releases[0]()
    const fifth = acquireStream("test:parallel")!
    expect(fifth).toBeTypeOf("function")
    expect(acquireStream("test:parallel")).toBeNull()
    releases.forEach((release) => release())
    fifth()
  })
  it("releases stream slots on completion, abort, cancellation, and errors", async () => {
    for (const mode of ["complete", "abort", "cancel", "error"]) {
      const release = vi.fn()
      const abort = new AbortController()
      const response = trackStream(
        new Response(
          new ReadableStream({
            start(controller) {
              if (mode === "complete") controller.close()
              if (mode === "error") controller.error(new Error("failed"))
            },
          })
        ),
        release,
        abort.signal
      )
      if (mode === "complete") await response.text()
      if (mode === "error") await expect(response.text()).rejects.toThrow()
      if (mode === "cancel") await response.body!.cancel()
      if (mode === "abort") {
        abort.abort()
        await response.text()
      }
      expect(release).toHaveBeenCalled()
    }
  })
  it("does not send repeated requests during a server cooldown", async () => {
    const operation = vi.fn(async () => {
      throw Object.assign(
        new Error("Please wait 30 seconds before trying again."),
        { code: "TOO_MANY_REQUESTS" }
      )
    })
    await expect(requestWithCooldown("read", operation)).rejects.toThrow()
    await expect(requestWithCooldown("read", operation)).rejects.toThrow()
    expect(operation).toHaveBeenCalledOnce()
  })
})
describe("stored links", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,evil",
    "https://user:password@example.com",
    "file:///etc/passwd",
    "not a URL",
  ])("does not link unsafe content %s", (value) =>
    expect(safeExternalUrl(value)).toBeUndefined()
  )
  it("preserves safe original posts", () =>
    expect(safeExternalUrl("https://www.tiktok.com/@user/video/123")).toBe(
      "https://www.tiktok.com/@user/video/123"
    ))
})
