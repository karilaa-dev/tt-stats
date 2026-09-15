import { describe, expect, it } from "vitest"
import { canonicalPostUrl, fullPostUrl } from "@/lib/media/post-links"
const metadata = {
  platform: "tiktok",
  videoId: "7539876543210000001",
  creator: "alice",
  canonicalLink: null,
  mediaKind: "video",
}
describe("history platform links", () => {
  it("reconstructs full posts from platform identity and validates stored canonical links", () => {
    const expected = "https://www.tiktok.com/@alice/video/7539876543210000001"
    expect(canonicalPostUrl(metadata)).toBe(expected)
    expect(
      canonicalPostUrl({
        ...metadata,
        canonicalLink: expected + "?share=1#tracking",
      })
    ).toBe(expected)
    expect(
      canonicalPostUrl({
        ...metadata,
        canonicalLink: "https://www.tiktok.com/@wrong/video/123",
      })
    ).toBe(expected)
    expect(
      canonicalPostUrl({
        ...metadata,
        canonicalLink: "https://evil.test/@alice/video/7539876543210000001",
      })
    ).toBe(expected)
    expect(canonicalPostUrl({ ...metadata, mediaKind: "images" })).toContain(
      "/photo/"
    )
  })
  it("distinguishes desktop posts with tracking from short and mobile shares", () => {
    for (const link of [
      "https://www.tiktok.com/@alice/video/123?is_from_webapp=1",
      "https://www.instagram.com/reel/AB_cd-12/?igsh=123",
    ])
      expect(fullPostUrl(link)).toBeTruthy()
    for (const link of [
      "https://vm.tiktok.com/ABC/",
      "https://vt.tiktok.com/ABC/",
      "https://www.tiktok.com/t/ABC/",
      "https://m.tiktok.com/v/123.html",
      "https://www.instagram.com/share/ABC",
      "javascript:alert(1)",
      "https://tiktok.com.evil.test/@alice/video/123",
      "https://www.tiktok.com:8443/@alice/video/123",
    ])
      expect(fullPostUrl(link)).toBeNull()
  })
  it("never turns an internal database identity into a platform ID", () => {
    expect(canonicalPostUrl({ ...metadata, videoId: null })).toBeNull()
    expect(canonicalPostUrl({ ...metadata, videoId: "invalid id" })).toBeNull()
    expect(
      canonicalPostUrl({ ...metadata, platform: "instagram", videoId: "123" })
    ).toBeNull()
    expect(
      canonicalPostUrl({
        ...metadata,
        platform: "instagram",
        videoId: "AbCd-12",
      })
    ).toBe("https://www.instagram.com/p/AbCd-12/")
  })
})

it("requires the canonical post segment itself to match the stored identity", () => {
  expect(
    canonicalPostUrl({
      ...metadata,
      platform: "instagram",
      videoId: "p",
      canonicalLink: "https://www.instagram.com/p/WRONG/",
    })
  ).toBe("https://www.instagram.com/p/p/")
})
