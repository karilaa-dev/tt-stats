import { afterEach, expect, it, vi } from "vitest"
import type { APIContext } from "astro"
import * as route from "@/src/pages/api/media/[downloadId]/[position]"
import { acquireStream } from "@/lib/security/rate-limit"

const media = vi.hoisted(() => ({
  fetch: vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3])))),
}))
vi.mock("@/lib/auth/session", () => ({
  getPrincipal: () => ({ admin: false, user: { id: "head-test" } }),
}))
vi.mock("@/lib/media/access", () => ({ canReadMedia: async () => true }))
vi.mock("@/lib/dev/fake-data", () => ({ isFakeDataEnabled: () => false }))
vi.mock("@/lib/media/queries", () => ({
  getStoredMedia: async () => ({ telegram_files: [{ position: 0 }] }),
}))
vi.mock("@/lib/media/telegram", () => ({
  MediaError: class extends Error {},
  mediaUnavailableReason: () => null,
  streamTelegramFile: media.fetch,
}))
afterEach(() => vi.clearAllMocks())

it("rejects HEAD without opening media or exhausting slots for subsequent GETs", async () => {
  const handler = Reflect.get(route, "HEAD") ?? route.GET
  const context = (method: string) =>
    ({
      params: { downloadId: "1", position: "0" },
      cookies: {},
      clientAddress: "127.0.0.1",
      request: new Request("https://example.test/api/media/1/0", { method }),
    }) as unknown as APIContext
  const responses: Response[] = []
  try {
    for (let i = 0; i < 4; i++) responses.push(await handler(context("HEAD")))
    // Astro discards the GET response body when implicitly handling HEAD.
    // Verify the route avoids creating that body in the first place.
    expect(responses.map((response) => response.status)).toEqual([
      405, 405, 405, 405,
    ])
    expect(responses.every((response) => response.body === null)).toBe(true)
    expect(responses[0].headers.get("allow")).toBe("GET")
    expect(media.fetch).not.toHaveBeenCalled()
    const get = await route.GET(context("GET"))
    expect(get.status).toBe(200)
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    )
    const releases = Array.from({ length: 4 }, () =>
      acquireStream("user:head-test")
    )
    releases.forEach((release) => release?.())
    expect(releases.every(Boolean)).toBe(true)
  } finally {
    for (const response of responses) await response.body?.cancel()
  }
})
