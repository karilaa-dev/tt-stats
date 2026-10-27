import { describe, expect, it, vi } from "vitest"
import { createAvatarReader } from "@/lib/telegram/avatar"

const token = "123:test-token"
const request = () => new Request("http://localhost/api/users/123/avatar")

describe("Telegram profile avatars", () => {
  it("proxies the small profile photo and caches its private file ID", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/getChat"))
        return Response.json({
          ok: true,
          result: {
            id: 123,
            photo: {
              small_file_id: "private-photo",
              big_file_id: "large-photo",
            },
          },
        })
      if (url.endsWith("/getFile"))
        return Response.json({
          ok: true,
          result: { file_path: "photos/avatar.jpg" },
        })
      return new Response("photo", {
        headers: { "Set-Cookie": "private=secret" },
      })
    })
    const read = createAvatarReader(fetcher)
    for (let i = 0; i < 2; i++) {
      const response = await read("123", request(), token)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("image/jpeg")
      expect(response.headers.get("cache-control")).toContain("private")
      expect(response.headers.get("set-cookie")).toBeNull()
      expect(response.headers.get("location")).toBeNull()
      expect(await response.text()).toBe("photo")
    }
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("/getChat"))
    ).toHaveLength(1)
    expect(
      fetcher.mock.calls.find(([url]) => url.endsWith("/getFile"))
    ).toBeTruthy()
  })

  it("handles missing photos, missing configuration, wrong identities, and network failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true, result: { id: 123 } }))
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          result: { id: 999, photo: { small_file_id: "wrong-user" } },
        })
      )
      .mockRejectedValueOnce(new Error(`Network failed for ${token}`))
    const read = createAvatarReader(fetcher)
    expect((await read("123", request(), "")).status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
    expect((await read("123", request(), token)).status).toBe(404)
    expect((await read("456", request(), token)).status).toBe(404)
    const failed = await read("789", request(), token)
    expect(failed.status).toBe(404)
    expect(await failed.text()).not.toContain(token)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})
