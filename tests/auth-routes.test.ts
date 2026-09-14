import { afterEach, describe, expect, it, vi } from "vitest"
import type { APIContext, AstroCookies } from "astro"
import { GET as callback } from "@/src/pages/api/auth/telegram/callback"
import { GET as getSession, DELETE as logout } from "@/src/pages/api/session"
import { telegramLoginFailureDetails } from "@/lib/auth/diagnostics"
import {
  createUserSession,
  getUserSession,
  loginTransactions,
  LOGIN_COOKIE,
  USER_COOKIE,
} from "@/lib/auth/session"
const finish = vi.hoisted(() => vi.fn())
vi.mock("@/lib/auth/telegram", () => ({
  finishTelegramLogin: finish,
  getOAuthEnv: () => null,
}))
function context(
  url: string,
  values: Record<string, string> = {},
  method = "GET",
  origin?: string
) {
  const store = new Map(Object.entries(values))
  const cookies = {
    get: (name: string) =>
      store.has(name) ? { value: store.get(name)! } : undefined,
    set: vi.fn((name: string, value: string) => {
      store.set(name, value)
    }),
    delete: vi.fn((name: string) => {
      store.delete(name)
    }),
  } as unknown as AstroCookies
  return {
    url: new URL(url),
    cookies,
    request: new Request(url, { method, headers: origin ? { origin } : {} }),
    redirect: (path: string, status: number) =>
      new Response(null, { status, headers: { Location: path } }),
  } as APIContext
}
afterEach(() => {
  finish.mockReset()
  vi.unstubAllEnvs()
})
describe("OAuth callback and logout", () => {
  it("logs only safe diagnostics when Telegram rejects the token exchange", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    loginTransactions.set(
      "failed-exchange",
      {
        state: "state",
        nonce: "nonce",
        verifier: "verifier",
        redirectUri: "https://example.test/api/auth/telegram/callback",
      },
      600_000
    )
    finish.mockRejectedValue(
      Object.assign(new Error("sentinel-client-secret"), {
        code: "OAUTH_RESPONSE_BODY_ERROR",
        error: "invalid_client",
        error_description: "sentinel-access-token",
        cause: { id_token: "sentinel-id-token" },
      })
    )
    const ctx = context(
      "https://example.test/api/auth/telegram/callback?state=state&code=code",
      { [LOGIN_COOKIE]: "failed-exchange" }
    )
    const response = await callback(ctx)
    expect(response.headers.get("location")).toBe("/dashboard/me?login=failed")
    expect(ctx.cookies.get(USER_COOKIE)).toBeUndefined()
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "[telegram-login] callback failed",
      {
        code: "OAUTH_RESPONSE_BODY_ERROR",
        providerError: "invalid_client",
        claim: "unknown",
        reason: "unknown",
        algorithm: "unknown",
      }
    )
    expect(JSON.stringify(log.mock.calls)).not.toContain("sentinel")
  })
  it("retains failing claim names without exposing claim values or arbitrary errors", () => {
    expect(
      telegramLoginFailureDetails({
        code: "OAUTH_JWT_CLAIM_COMPARISON_FAILED",
        cause: { claim: "nonce", claims: { nonce: "sentinel-nonce" } },
      })
    ).toEqual({
      code: "OAUTH_JWT_CLAIM_COMPARISON_FAILED",
      providerError: "unknown",
      claim: "nonce",
      reason: "unknown",
      algorithm: "unknown",
    })
    for (const error of [
      undefined,
      "sentinel-error",
      {
        code: "sentinel-code",
        error: "sentinel-error",
        cause: { claim: "sentinel-claim" },
      },
    ]) {
      expect(telegramLoginFailureDetails(error)).toEqual({
        code: "unknown",
        providerError: "unknown",
        claim: "unknown",
        reason: "unknown",
        algorithm: "unknown",
      })
    }
  })
  it("bounds cyclic causes and redacts nested messages and header values", () => {
    const error = new Error("sentinel-top-level")
    const cause = {
      message: 'unexpected JWT "alg" header parameter: sentinel-secret',
      header: { alg: "sentinel-secret" },
      claim: "sentinel-secret",
      cause: error,
    }
    error.cause = cause
    expect(telegramLoginFailureDetails(error)).toEqual({
      code: "unknown",
      providerError: "unknown",
      claim: "unknown",
      reason: "unknown",
      algorithm: "unknown",
    })
  })
  it("consumes login transactions once and replaces the previous session", async () => {
    const previous = createUserSession({
      id: "1",
      name: "Before",
      username: null,
    })
    loginTransactions.set(
      "route-test",
      {
        state: "state",
        nonce: "nonce",
        verifier: "verifier",
        redirectUri: "https://example.test/api/auth/telegram/callback",
      },
      600_000
    )
    finish.mockResolvedValue({ id: "2", name: "After", username: null })
    const ctx = context(
      "https://example.test/api/auth/telegram/callback?state=state&code=code",
      { [LOGIN_COOKIE]: "route-test", [USER_COOKIE]: previous }
    )
    expect((await callback(ctx)).headers.get("location")).toBe("/dashboard/me")
    const token = ctx.cookies.get(USER_COOKIE)!.value
    expect(getUserSession(token)?.id).toBe("2")
    expect(getUserSession(previous)).toBeNull()
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      USER_COOKIE,
      token,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 604800,
      })
    )
    const replay = context(ctx.url.href, { [LOGIN_COOKIE]: "route-test" })
    expect((await callback(replay)).headers.get("location")).toContain(
      "login=expired"
    )
    expect(finish).toHaveBeenCalledOnce()
  })
  it.each([
    "state=wrong&code=code",
    "state=state&state=state&code=code",
    "state=state&error=access_denied",
  ])("does not create a session for %s", async (query) => {
    loginTransactions.set(
      "reject-test",
      {
        state: "state",
        nonce: "nonce",
        verifier: "verifier",
        redirectUri: "https://example.test/api/auth/telegram/callback",
      },
      600_000
    )
    const ctx = context(
      `https://example.test/api/auth/telegram/callback?${query}`,
      { [LOGIN_COOKIE]: "reject-test" }
    )
    expect((await callback(ctx)).status).toBe(303)
    expect(ctx.cookies.get(USER_COOKIE)).toBeUndefined()
    expect(finish).not.toHaveBeenCalled()
    expect(loginTransactions.take("reject-test")).toBeUndefined()
  })
  it("rejects cross-origin logout and exposes only the current safe profile", async () => {
    const token = createUserSession({ id: "123", name: "User", username: null })
    const values = { [USER_COOKIE]: token }
    const session = await getSession(
      context("https://example.test/api/session", values)
    )
    expect(await session.json()).toEqual({
      user: { id: "123", name: "User", username: null },
      admin: false,
      loginAvailable: false,
    })
    expect(session.headers.get("cache-control")).toBe("no-store")
    expect(
      (
        await logout(
          context(
            "https://example.test/api/session",
            values,
            "DELETE",
            "https://evil.example"
          )
        )
      ).status
    ).toBe(403)
    expect(getUserSession(token)).not.toBeNull()
    expect(
      (
        await logout(
          context(
            "https://example.test/api/session",
            values,
            "DELETE",
            "https://example.test"
          )
        )
      ).status
    ).toBe(200)
    expect(getUserSession(token)).toBeNull()
  })
})
