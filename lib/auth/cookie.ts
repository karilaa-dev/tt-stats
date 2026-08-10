export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-tt-stats-session"
    : "tt-stats-session"
}
