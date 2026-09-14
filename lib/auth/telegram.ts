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
    !("error" in body) ||
    typeof body.error !== "string" ||
    !body.error
  )
    return response

  // Telegram returns OAuth errors with HTTP 200. The library checks error
  // bodies only for unsuccessful statuses; otherwise it reports a missing
  // access token and hides the actual provider error. Preserve the body and
  // let its standard OAuth error parser reject it. Successful replies are
  // never modified or supplied with synthetic credentials.
  return new Response(response.body, { status: 400, headers: response.headers })
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
      (_server, client, _body, headers) => {
        // Telegram documents base64(client_id:client_secret), without OAuth
        // form-encoding first. ClientSecretBasic encodes even '_' as '%5F',
        // changing the secret Telegram receives after decoding the header.
        headers.set(
          "authorization",
          `Basic ${Buffer.from(`${client.client_id}:${env.secret}`, "utf8").toString("base64")}`
        )
      },
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
  if (claims.id === undefined) throw new Error("Missing Telegram user ID")
  const id =
    typeof claims.id === "string" && /^[1-9]\d{0,15}$/u.test(claims.id)
      ? Number(claims.id)
      : claims.id
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
