type Kind = "read" | "metadata" | "media" | "csv" | "login"
const cooldowns = new Map<Kind, { until: number; error: Error }>()
export function noteCooldown(kind: Kind, seconds: number) {
  const error = Object.assign(
    new Error(`Please wait ${seconds} seconds before trying again.`),
    { code: "TOO_MANY_REQUESTS" }
  )
  cooldowns.set(kind, { until: Date.now() + seconds * 1000, error })
  return error
}
export async function requestWithCooldown<T>(
  kind: Kind,
  operation: () => Promise<T>
): Promise<T> {
  const blocked = cooldowns.get(kind)
  if (blocked && blocked.until > Date.now()) throw blocked.error
  try {
    return await operation()
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "TOO_MANY_REQUESTS"
    ) {
      const seconds =
        error instanceof Error
          ? Number(error.message.match(/wait (\d+) seconds/u)?.[1] ?? 60)
          : 60
      noteCooldown(kind, Math.max(1, seconds))
    }
    throw error
  }
}
export function clearCooldowns() {
  cooldowns.clear()
}
export async function sessionRequest() {
  return requestWithCooldown("read", async () => {
    const response = await fetch("/api/session", { cache: "no-store" })
    if (response.status === 429)
      throw noteCooldown(
        "read",
        Number(response.headers.get("Retry-After")) || 60
      )
    if (!response.ok) throw new Error("Could not check your login. Try again.")
    return response.json()
  })
}
