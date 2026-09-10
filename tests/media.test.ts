import { afterEach, describe, expect, it, vi } from "vitest"
import {
  describeMedia,
  mediaUnavailableReason,
  streamTelegramFile,
} from "@/lib/media/telegram"
import type { StoredMedia } from "@/lib/media/queries"

const token = "123:secret"
const media: StoredMedia = {
  telegram_bot_id: "123",
  telegram_files: [
    { position: 0, media_type: "video", file_id: "private-file-id" },
    { position: 1, media_type: "photo", file_id: "private-photo-id" },
  ],
}

afterEach(() => vi.unstubAllEnvs())

describe("saved media", () => {
  it("keeps file IDs and bot credentials out of preview metadata", () => {
    vi.stubEnv("BOT_TOKEN", token)
    const result = describeMedia("9007199254740993", media)
    expect(result).toEqual({
      unavailableReason: null,
      items: [
        {
          position: 0,
          mediaType: "video",
          url: "/api/media/9007199254740993/0",
        },
        {
          position: 1,
          mediaType: "photo",
          url: "/api/media/9007199254740993/1",
        },
      ],
    })
    expect(JSON.stringify(result)).not.toContain("private-")
    expect(JSON.stringify(result)).not.toContain(token)
  })

  it("handles missing files, missing configuration, and IDs owned by another bot", () => {
    expect(mediaUnavailableReason(null, token)).toContain("No saved media")
    expect(
      mediaUnavailableReason({ ...media, telegram_files: [] }, token)
    ).toContain("No saved media")
    expect(mediaUnavailableReason(media, "")).toContain("Configure BOT_TOKEN")
    expect(mediaUnavailableReason(media, "456:secret")).toContain(
      "different Telegram bot"
    )
  })

  it("proxies byte ranges and streams media without upstream credentials or cookies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ok: true, result: { file_path: "videos/file.mp4" } })
      )
      .mockResolvedValueOnce(
        new Response("part", {
          status: 206,
          headers: {
            "Content-Range": "bytes 0-3/100",
            "Content-Length": "4",
            "Accept-Ranges": "bytes",
            "Set-Cookie": "upstream=secret",
            Location: `https://api.telegram.org/${token}`,
          },
        })
      )
    const response = await streamTelegramFile(
      media.telegram_files![0]!,
      new Request("http://localhost/api/media/1/0", {
        headers: { Range: "bytes=0-3", Cookie: "admin=private" },
      }),
      token,
      fetcher
    )
    expect(response.status).toBe(206)
    expect(response.headers.get("content-range")).toBe("bytes 0-3/100")
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(response.headers.get("location")).toBeNull()
    expect(fetcher.mock.calls[1]?.[1].headers).toEqual({ Range: "bytes=0-3" })
    expect(await response.text()).toBe("part")
  })

  it("reports oversized files and sanitizes network errors", async () => {
    const request = new Request("http://localhost/api/media/1/0")
    await expect(
      streamTelegramFile(
        media.telegram_files![0]!,
        request,
        token,
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { ok: false, description: "Bad Request: file is too big" },
              { status: 400 }
            )
          )
      )
    ).rejects.toThrow("20 MB")
    await expect(
      streamTelegramFile(
        media.telegram_files![0]!,
        request,
        token,
        vi
          .fn()
          .mockRejectedValue(
            new Error(
              `Network failed at https://api.telegram.org/bot${token}/getFile`
            )
          )
      )
    ).rejects.toThrow("The saved media could not be loaded.")
  })

  it("rejects unsafe paths and multiple ranges before fetching file contents", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ok: true, result: { file_path: "../secret" } })
      )
    await expect(
      streamTelegramFile(
        media.telegram_files![0]!,
        new Request("http://localhost"),
        token,
        fetcher
      )
    ).rejects.toThrow("invalid file path")
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockClear()
    await expect(
      streamTelegramFile(
        media.telegram_files![0]!,
        new Request("http://localhost", {
          headers: { Range: "bytes=0-1,4-5" },
        }),
        token,
        fetcher
      )
    ).rejects.toMatchObject({ status: 416 })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
