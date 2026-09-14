import "@/lib/server-only"
import * as oidc from "openid-client"
import type { TelegramUser } from "./types"
import { randomToken, type LoginTransaction } from "./session"

const telegramFetch: oidc.CustomFetch = async (url, options) => {
  // The library's Uint8Array body type is broader than the DOM fetch typings.
  const response = await fetch(url, options as RequestInit)
  if (
    url !== "https://oauth.telegram.org/token" ||
    options.method !== "POST" ||
    response.status !== 200 ||
    response.headers.has("www-authenticate") ||
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    return response

  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    "error" in body ||
    !("id_token" in body) ||
    typeof body.id_token !== "string" ||
    !body.id_token ||
    ("access_token" in body &&
      body.access_token !== null &&
      body.access_token !== undefined &&
      body.access_token !== "")
  )
    return response

  // Telegram may return only an ID token. openid-client requires access-token
  // fields even though this application never uses or exposes an access token.
  // Supply a non-credential placeholder solely for its response parser. The
  // original ID token still passes all claim and signature checks below.
  const normalized = {
    ...body,
    access_token: "unused-telegram-login-access-token",
  }
  if (
    !("token_type" in normalized) ||
    normalized.token_type == null ||
    normalized.token_type === ""
  ) {
    Object.assign(normalized, { token_type: "Bearer" })
  }
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  headers.delete("content-encoding")
  headers.set("cache-control", "no-store")
  return Response.json(normalized, { headers })
}

export function getOAuthEnv(source = process.env) {
  const id = source.TELEGRAM_OAUTH_CLIENT_ID?.trim()
  const secret = source.TELEGRAM_OAUTH_CLIENT_SECRET?.trim()
  const origin = source.APP_ORIGIN?.trim() || "https://tt-stats.karilaa.dev"
  if (!id || !/^\d+$/u.test(id) || !secret) return null
  try {
    const url = new URL(origin)
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null
    if (
      url.protocol !== "https:" &&
      !(
        source.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null
    return { id, secret, origin: url.origin }
  } catch {
    return null
  }
}
let configuration:
  { key: string; promise: Promise<oidc.Configuration> } | undefined
async function config() {
  const env = getOAuthEnv()
  if (!env) throw new Error("Telegram login unavailable")
  const key = `${env.id}:${env.secret}`
  if (!configuration || configuration.key !== key) {
    const promise = oidc.discovery(
      new URL("https://oauth.telegram.org"),
      env.id,
      {
        client_secret: env.secret,
        id_token_signed_response_alg: "RS256",
      },
      oidc.ClientSecretBasic(env.secret),
      {
        timeout: 10,
        [oidc.customFetch]: telegramFetch,
        execute: [oidc.enableNonRepudiationChecks],
      }
    )
    configuration = { key, promise }
    void promise.catch(() => {
      if (configuration?.promise === promise) configuration = undefined
    })
  }
  return configuration.promise
}
export async function beginTelegramLogin() {
  const env = getOAuthEnv()
  if (!env) throw new Error("Telegram login unavailable")
  const verifier = oidc.randomPKCECodeVerifier()
  const transaction: LoginTransaction = {
    verifier,
    state: randomToken(),
    nonce: randomToken(),
    redirectUri: `${env.origin}/api/auth/telegram/callback`,
  }
  const url = oidc.buildAuthorizationUrl(await config(), {
    redirect_uri: transaction.redirectUri,
    scope: "openid profile",
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state: transaction.state,
    nonce: transaction.nonce,
  })
  return { url, transaction }
}
export function telegramUserFromClaims(
  claims: Record<string, unknown>
): TelegramUser {
  // Telegram's OIDC subject is not the numeric Bot API user ID.
  const id = claims.id
  if (!(typeof id === "number" && Number.isSafeInteger(id) && id > 0))
    throw new Error("Invalid Telegram identity")
  return {
    id: String(id),
    name:
      typeof claims.name === "string"
        ? claims.name.slice(0, 200)
        : "Telegram user",
    username:
      typeof claims.preferred_username === "string" &&
      /^[A-Za-z0-9_]{1,64}$/u.test(claims.preferred_username)
        ? claims.preferred_username
        : null,
  }
}
export async function finishTelegramLogin(
  url: URL,
  transaction: LoginTransaction
) {
  const callback = new URL(transaction.redirectUri)
  callback.search = url.search
  const configuration = await config()
  const tokens = await oidc.authorizationCodeGrant(
    configuration,
    callback,
    {
      pkceCodeVerifier: transaction.verifier,
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    },
    // Telegram's token endpoint expects this in addition to Basic client auth.
    { client_id: configuration.clientMetadata().client_id }
  )
  const claims = tokens.claims()
  if (!claims) throw new Error("Missing Telegram identity")
  return telegramUserFromClaims(claims)
}
