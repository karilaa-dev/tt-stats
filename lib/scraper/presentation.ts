/** Error codes describe a previous request, not whether an identity is dead. */
export function scraperFailureMessage(code: string): string {
  const messages: Record<string, string> = {
    upstream_invalid_response: "TikTok returned an unexpected response.",
    upstream_network_error: "The proxy could not reach TikTok.",
    upstream_unavailable: "TikTok was temporarily unavailable.",
    upstream_rate_limited: "TikTok temporarily limited requests.",
    login_required: "This account needs to log in again.",
    challenge_required: "This account needs verification.",
    checkpoint_required: "This account needs a security check.",
  }
  return messages[code] ?? "The scraper recorded a request error."
}
