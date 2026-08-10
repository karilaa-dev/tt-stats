export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/dashboard"
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard"
  if (!value.startsWith("/dashboard")) return "/dashboard"
  return value
}
