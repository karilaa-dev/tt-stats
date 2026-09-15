import { safeExternalUrl } from "@/lib/security/links"

/** Recognize full post URLs, not short/share redirects on the same host. */
export function fullPostUrl(value?: string | null): string | null {
  const safe = safeExternalUrl(value)
  if (!safe) return null
  const url = new URL(safe)
  const host = url.hostname.replace(/^www\./u, "").toLowerCase()
  const post =
    host === "tiktok.com"
      ? /^\/@[^/]*\/(?:video|photo)\/\d+\/?$/u.test(url.pathname)
      : host === "instagram.com" &&
        /^\/(?:p|reel|tv)\/[\w-]+\/?$/u.test(url.pathname)
  if (!post || url.port) return null
  url.protocol = "https:"
  url.search = ""
  url.hash = ""
  return url.href
}

export function canonicalPostUrl(input: {
  platform: string | null
  videoId: string | null
  creator: string | null
  canonicalLink: string | null
  mediaKind: string
}): string | null {
  const id = input.videoId?.trim()
  if (!id) return null
  const stored = fullPostUrl(input.canonicalLink)
  if (stored) {
    const url = new URL(stored)
    const host = url.hostname.replace(/^www\./u, "")
    if (
      host === `${input.platform}.com` &&
      url.pathname.split("/").filter(Boolean).at(-1) === id
    )
      return stored
  }
  if (input.platform === "tiktok" && /^\d+$/u.test(id)) {
    const creator = input.creator?.trim().replace(/^@/u, "") ?? ""
    const handle = /^[\w.]*$/u.test(creator) ? creator : ""
    return `https://www.tiktok.com/@${handle}/${input.mediaKind === "images" ? "photo" : "video"}/${id}`
  }
  // Instagram's platform ID is a shortcode. Do not manufacture a URL from a
  // numeric media database ID, which is not an Instagram shortcode.
  if (
    input.platform === "instagram" &&
    /^[\w-]+$/u.test(id) &&
    !/^\d+$/u.test(id)
  )
    return `https://www.instagram.com/p/${id}/`
  return null
}

/** Only recognizable short/mobile sharing links supplement a canonical post. */
export function isSharingUrl(value?: string | null): boolean {
  const safe = safeExternalUrl(value)
  if (!safe) return false
  const url = new URL(safe)
  if (
    [
      "vm.tiktok.com",
      "vt.tiktok.com",
      "m.tiktok.com",
      "m.instagram.com",
    ].includes(url.hostname)
  )
    return true
  const host = url.hostname.replace(/^www\./u, "")
  return (
    (host === "tiktok.com" && /^\/t\/[^/]+\/?$/u.test(url.pathname)) ||
    (host === "instagram.com" && /^\/share\/[^/]+/u.test(url.pathname))
  )
}
