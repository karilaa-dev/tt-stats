import { afterEach, describe, expect, it, vi } from "vitest"
import { generateKeyPairSync, sign } from "node:crypto"
import {
  beginTelegramLogin,
  finishTelegramLogin,
  getOAuthEnv,
  telegramUserFromClaims,
} from "@/lib/auth/telegram"
import { MemoryStore } from "@/lib/auth/memory"
import { telegramLoginFailureDetails } from "@/lib/auth/diagnostics"
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
} from "@/lib/auth/session"

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 })
const jwk = {
  ...keys.publicKey.export({ format: "jwk" }),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
}
const issuer = "https://oauth.telegram.org"
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url")
const signedToken = (claims: Record<string, unknown>, alg = "RS256") => {
  const payload = `${encode({ alg, kid: "test-key" })}.${encode(claims)}`
  return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), keys.privateKey).toString("base64url")}`
}
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
async function flow(
  change: Record<string, unknown> = {},
  forged = false,
  responseChange: Record<string, unknown> = {},
  alg = "RS256",
  responseStatus = 200
) {
  vi.stubEnv("TELEGRAM_OAUTH_CLIENT_ID", "123456")
  vi.stubEnv("TELEGRAM_OAUTH_CLIENT_SECRET", "test-oauth-secret")
  vi.stubEnv("APP_ORIGIN", "https://stats.example")
  let token = ""
  const calls: { url: string; body: string; authorization: string | null }[] =
    []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      calls.push({
        url,
        body: String(init?.body ?? ""),
        authorization: new Headers(init?.headers).get("authorization"),
      })
      if (url.endsWith("openid-configuration"))
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/auth`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/keys`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
        })
      if (url.endsWith("/keys")) return Response.json({ keys: [jwk] })
      if (url.endsWith("/token"))
        return Response.json(
          {
            access_token: "unused",
            token_type: "Bearer",
            id_token: token,
            ...responseChange,
          },
          { status: responseStatus }
        )
      throw new Error("Unexpected outgoing URL")
    })
  )
  const result = await beginTelegramLogin()
  const epoch = Math.floor(Date.now() / 1000)
  token = signedToken(
    {
      iss: issuer,
      aud: "123456",
      sub: "not-the-bot-user-id",
      id: 987654321,
      name: "Test user",
      nonce: result.transaction.nonce,
      iat: epoch,
      exp: epoch + 3600,
      ...change,
    },
    alg
  )
  if (forged)
    token =
      token.slice(0, token.lastIndexOf(".") + 1) +
      Buffer.alloc(256).toString("base64url")
  const callback = new URL(result.transaction.redirectUri)
  callback.searchParams.set("code", "test-authorization-code")
  callback.searchParams.set("state", result.transaction.state)
  return { ...result, callback, calls }
}
describe("official Telegram OIDC", () => {
  it.each([
    { claims: { nonce: undefined }, reason: "missing_nonce", claim: "nonce" },
    { claims: { nonce: "wrong" }, reason: "unexpected_nonce", claim: "nonce" },
    { claims: { aud: 123456 }, reason: "invalid_aud_type", claim: "aud" },
    {
      alg: "ES256",
      reason: "unexpected_signing_algorithm",
      algorithm: "ES256",
    },
    { response: { access_token: 123 }, reason: "invalid_access_token" },
    { forged: true, reason: "signature_verification_failed" },
  ])("identifies real OIDC failures: $reason", async (test) => {
    const { callback, transaction } = await flow(
      test.claims,
      test.forged,
      test.response,
      test.alg
    )
    const error = await finishTelegramLogin(callback, transaction).catch(
      (error: unknown) => error
    )
    expect(error).toBeInstanceOf(Error)
    expect(telegramLoginFailureDetails(error)).toMatchObject({
      reason: test.reason,
      claim: test.claim ?? "unknown",
      algorithm: test.algorithm ?? "unknown",
    })
  })
  it.each([
    { access_token: undefined, token_type: undefined },
    { access_token: null, token_type: null },
    { access_token: "", token_type: "" },
    { access_token: "", token_type: "Bearer" },
  ])("accepts a verified ID-token-only response: %j", async (response) => {
    const { callback, transaction } = await flow({}, false, response)
    expect(await finishTelegramLogin(callback, transaction)).toEqual({
      id: "987654321",
      name: "Test user",
      username: null,
    })
  })
  it.each([
    { claims: { iss: "https://attacker.example" } },
    { claims: { aud: "other-client" } },
    { claims: { exp: 1 } },
    { claims: { nonce: undefined } },
    { claims: { nonce: "wrong-nonce" } },
    { claims: { id: undefined } },
    { forged: true },
    { alg: "ES256" },
    { response: { id_token: undefined } },
    { response: { id_token: "" } },
    { response: { id_token: "invalid.jwt.token" } },
    { response: { error: "invalid_grant" } },
    { response: { token_type: "invalid" } },
    { response: { token_type: 123 } },
    { status: 400 },
    { status: 401 },
  ])("still rejects invalid ID-token-only responses: %j", async (test) => {
    const { callback, transaction } = await flow(
      test.claims,
      test.forged,
      {
        access_token: "",
        token_type: undefined,
        ...test.response,
      },
      test.alg,
      test.status
    )
    await expect(finishTelegramLogin(callback, transaction)).rejects.toThrow()
  })
  it("uses PKCE, nonce, minimal scopes, Basic client auth, and verified profile ID", async () => {
    const { url, transaction, callback, calls } = await flow()
    expect(url.origin).toBe(issuer)
    expect(url.searchParams.get("scope")).toBe("openid profile")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("nonce")).toBe(transaction.nonce)
    expect(url.href).not.toContain("test-oauth-secret")
    expect(await finishTelegramLogin(callback, transaction)).toEqual({
      id: "987654321",
      name: "Test user",
      username: null,
    })
    const exchange = calls.find((call) => call.url.endsWith("/token"))!
    expect(new URLSearchParams(exchange.body).get("client_id")).toBe("123456")
    expect(
      decodeURIComponent(
        Buffer.from(exchange.authorization!.slice(6), "base64").toString()
      )
    ).toBe("123456:test-oauth-secret")
    expect(new URLSearchParams(exchange.body).get("code_verifier")).toBe(
      transaction.verifier
    )
  })
  it.each([
    { iss: "https://attacker.example" },
    { aud: "other-client" },
    { exp: 1 },
    { nonce: "wrong-nonce" },
    { nonce: undefined },
    { id: undefined },
    { id: -1 },
  ])("rejects invalid claims %j", async (claims) => {
    const { callback, transaction } = await flow(claims)
    await expect(finishTelegramLogin(callback, transaction)).rejects.toThrow()
  })
  it("rejects a forged signature", async () => {
    const { callback, transaction } = await flow({}, true)
    await expect(finishTelegramLogin(callback, transaction)).rejects.toThrow()
  })
  it("rejects wrong state before exchanging a code", async () => {
    const { callback, transaction, calls } = await flow()
    callback.searchParams.set("state", "wrong")
    await expect(finishTelegramLogin(callback, transaction)).rejects.toThrow()
    expect(calls.some((call) => call.url.endsWith("/token"))).toBe(false)
  })
  it("never substitutes sub for the Telegram ID", () => {
    expect(() => telegramUserFromClaims({ sub: "123" })).toThrow()
    expect(() =>
      telegramUserFromClaims({ id: Number.MAX_SAFE_INTEGER + 1 })
    ).toThrow()
  })
  it("requires a safe canonical origin and server credentials", () => {
    expect(
      getOAuthEnv({
        TELEGRAM_OAUTH_CLIENT_ID: "1",
        TELEGRAM_OAUTH_CLIENT_SECRET: "secret",
        APP_ORIGIN: "https://user:secret@evil.example",
        NODE_ENV: "production",
      })
    ).toBeNull()
    expect(
      getOAuthEnv({
        TELEGRAM_OAUTH_CLIENT_ID: "1",
        TELEGRAM_OAUTH_CLIENT_SECRET: "secret",
        APP_ORIGIN: "http://localhost",
        NODE_ENV: "production",
      })
    ).toBeNull()
    expect(getOAuthEnv({})).toBeNull()
  })
})
describe("RAM sessions and transactions", () => {
  it("expires entries, consumes transactions once, and rejects capacity exhaustion", () => {
    let now = 0
    const store = new MemoryStore<string>(1, () => now)
    store.set("first", "value", 100)
    expect(() => store.set("second", "value", 100)).toThrow()
    expect(store.take("first")).toBe("value")
    expect(store.take("first")).toBeUndefined()
    store.set("second", "value", 100)
    now = 100
    expect(store.get("second")).toBeUndefined()
    store.set("third", "value", 100)
    expect(new MemoryStore<string>(1).get("third")).toBeUndefined()
  })
  it("uses opaque, independent sessions and invalidates a logged-out session", () => {
    const user = { id: "123", name: "Test user", username: null }
    const token = createUserSession(user)
    const second = createUserSession(user)
    expect(token).not.toBe(second)
    expect(token).not.toContain("Test user")
    expect(getUserSession(token)).toEqual(user)
    expect(getUserSession(`${token}x`)).toBeNull()
    deleteUserSession(token)
    expect(getUserSession(token)).toBeNull()
    expect(getUserSession(second)).toEqual(user)
    deleteUserSession(second)
  })
})
