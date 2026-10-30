// Video and album media use the videos.pk_id. Audio history entries use the
// music.pk_id with an "audio:" prefix, matching the history item ID.
export type MediaId =
  { kind: "download"; id: string } | { kind: "audio"; id: string }

const pattern = /^(audio:)?([1-9]\d{0,18})$/u

export function parseMediaId(value: string): MediaId | null {
  const match = pattern.exec(value)
  if (!match || BigInt(match[2]!) > 9223372036854775807n) return null
  return { kind: match[1] ? "audio" : "download", id: match[2]! }
}

/** Route parameters arrive percent-encoded ("audio%3A1"); decode before parsing. */
export function parseMediaIdParam(value: string | undefined): MediaId | null {
  try {
    return parseMediaId(decodeURIComponent(value ?? ""))
  } catch {
    return null
  }
}
