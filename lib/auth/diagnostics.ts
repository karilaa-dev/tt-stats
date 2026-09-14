import "@/lib/server-only"

// OIDC errors can contain whole tokens, claims, and HTTP responses. Log only
// known diagnostic labels, never raw messages, stacks, or raw causes.
function allowed(value: unknown, values: readonly string[]) {
  return typeof value === "string" && values.includes(value) ? value : "unknown"
}

const reasons = new Map<string, { reason: string; claim?: string }>([
  [
    'unexpected JWT "alg" header parameter',
    { reason: "unexpected_signing_algorithm" },
  ],
  [
    "JWT signature verification failed",
    { reason: "signature_verification_failed" },
  ],
  ["Invalid JWT", { reason: "invalid_jwt" }],
  ["JWT Header must be a top level object", { reason: "invalid_jwt_header" }],
  ["JWT Payload must be a top level object", { reason: "invalid_jwt_payload" }],
  [
    'unexpected JWT "typ" header parameter value',
    { reason: "invalid_jwt_type" },
  ],
  [
    '"response" body must be a top level object',
    { reason: "invalid_response_body" },
  ],
  [
    '"response" body "keys" property must be an array',
    { reason: "invalid_jwks" },
  ],
  [
    '"response" body "keys" property members must be JWK formatted objects',
    { reason: "invalid_jwks" },
  ],
  [
    'response parameter "iss" (issuer) missing',
    { reason: "missing_callback_issuer" },
  ],
  [
    'unexpected "iss" (issuer) response parameter value',
    { reason: "unexpected_callback_issuer" },
  ],
  ['no authorization code in "callbackParameters"', { reason: "missing_code" }],
  [
    'unexpected ID Token "nonce" claim value',
    { reason: "unexpected_nonce", claim: "nonce" },
  ],
  ["Invalid Telegram identity", { reason: "invalid_telegram_id", claim: "id" }],
  ["Missing Telegram identity", { reason: "missing_id_token" }],
])
for (const field of ["code", "state", "iss", "response"]) {
  reasons.set(`"${field}" parameter must be provided only once`, {
    reason: `duplicate_${field}`,
  })
}
const claimNames = {
  aud: "audience",
  exp: "expiration time",
  iat: "issued at",
  iss: "issuer",
  sub: "subject",
  nonce: "nonce",
  nbf: "not before",
  azp: "authorized party",
  auth_time: "authentication time",
}
for (const [claim, name] of Object.entries(claimNames)) {
  reasons.set(`JWT "${claim}" (${name}) claim missing`, {
    reason: `missing_${claim}`,
    claim,
  })
  reasons.set(`unexpected JWT "${claim}" (${name}) claim type`, {
    reason: `invalid_${claim}_type`,
    claim,
  })
}
for (const field of [
  "access_token",
  "token_type",
  "refresh_token",
  "id_token",
  "scope",
  "expires_in",
]) {
  for (const suffix of [
    "must be a string",
    "must not be empty",
    "must be a number",
    "must be a non-negative number",
  ]) {
    reasons.set(`"response" body "${field}" property ${suffix}`, {
      reason: `invalid_${field}`,
    })
  }
}

export function telegramLoginFailureDetails(error: unknown) {
  const detail = error && typeof error === "object" ? error : {}
  const result = {
    reason: "unknown",
    algorithm: "unknown",
    code: allowed("code" in detail ? detail.code : undefined, [
      "OAUTH_RESPONSE_BODY_ERROR",
      "OAUTH_WWW_AUTHENTICATE_CHALLENGE",
      "OAUTH_INVALID_RESPONSE",
      "OAUTH_JWT_CLAIM_COMPARISON_FAILED",
      "OAUTH_JWT_TIMESTAMP_CHECK_FAILED",
      "OAUTH_KEY_SELECTION_FAILED",
      "OAUTH_MISSING_SERVER_METADATA",
      "OAUTH_UNSUPPORTED_OPERATION",
      "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED",
      "OAUTH_INVALID_SERVER_METADATA",
      "OAUTH_PARSE_ERROR",
      "OAUTH_TIMEOUT",
    ]),
    providerError: allowed("error" in detail ? detail.error : undefined, [
      "invalid_client",
      "invalid_grant",
      "invalid_request",
      "invalid_scope",
      "unauthorized_client",
      "unsupported_grant_type",
      "server_error",
      "temporarily_unavailable",
    ]),
    claim: "unknown",
  }
  // openid-client wraps oauth4webapi's error, which itself wraps claim/header
  // details. Bound traversal so malformed or cyclic causes cannot loop.
  let current: unknown = error
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    const message = "message" in current ? current.message : undefined
    const known = typeof message === "string" ? reasons.get(message) : undefined
    if (known) {
      result.reason = known.reason
      if (known.claim) result.claim = known.claim
    }
    const claim = allowed("claim" in current ? current.claim : undefined, [
      ...Object.keys(claimNames),
      "id",
    ])
    if (claim !== "unknown") result.claim = claim
    const header = "header" in current ? current.header : undefined
    const algorithm = allowed(
      header && typeof header === "object" && "alg" in header
        ? header.alg
        : undefined,
      ["RS256", "ES256", "EdDSA", "ES256K", "HS256", "none"]
    )
    if (algorithm !== "unknown") result.algorithm = algorithm
    current = "cause" in current ? current.cause : undefined
  }
  return result
}
