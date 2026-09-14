export function safeExternalUrl(
  value: string | null | undefined
): string | undefined {
  if (!value) return
  try {
    const url = new URL(value)
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href
  } catch {
    /* Invalid stored URLs are displayed as text. */
  }
}
