import "@/lib/server-only"

// OIDC errors can contain whole tokens, claims, and HTTP responses. Log only
// known diagnostic labels, never messages, stacks, or raw causes.
function allowed(value: unknown, values: readonly string[]) {
  return typeof value === "string" && values.includes(value) ? value : "unknown"
}

export function telegramLoginFailureDetails(error: unknown) {
  const detail = error && typeof error === "object" ? error : {}
  const cause = "cause" in detail ? detail.cause : undefined
  return {
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
    claim: allowed(
      cause && typeof cause === "object" && "claim" in cause
        ? cause.claim
        : undefined,
      ["iss", "aud", "exp", "iat", "nbf", "nonce", "azp", "auth_time"]
    ),
  }
}
