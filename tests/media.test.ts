import { afterEach, describe, expect, it, vi } from "vitest"
import {
  describeMedia,
  mediaUnavailableReason,
  streamTelegramFile,
} from "@/lib/media/telegram"
import type { StoredMedia } from "@/lib/media/queries"
import { parseMediaId, parseMediaIdParam } from "@/lib/media/ids"
import { formatPlaybackTime } from "@/components/dashboard/audio-player"

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

  it("describes an audio download as the sound of the post's saved video", () => {
    vi.stubEnv("BOT_TOKEN", token)
    expect(describeMedia("audio:42", media)).toEqual({
      unavailableReason: null,
      items: [
        { position: 0, mediaType: "audio", url: "/api/media/audio:42/0" },
      ],
    })
    // A slideshow has photos only, so there is no sound to play.
    const slideshow: StoredMedia = {
      telegram_bot_id: "123",
      telegram_files: [
        { position: 0, media_type: "photo", file_id: "private-photo-id" },
      ],
    }
    for (const stored of [slideshow, null])
      expect(describeMedia("audio:42", stored)).toEqual({
        unavailableReason: "No saved sound is available for this download.",
        items: [],
      })
    expect(describeMedia("audio:42", media).items).toHaveLength(1)
    expect(JSON.stringify(describeMedia("audio:42", media))).not.toContain(
      "private-"
    )
  })

  it("accepts video and audio media IDs within the PostgreSQL bigint range", () => {
    expect(parseMediaId("9007199254740993")).toEqual({
      kind: "download",
      id: "9007199254740993",
    })
    expect(parseMediaId("audio:42")).toEqual({ kind: "audio", id: "42" })
    for (const invalid of [
      "",
      "0",
      "abc",
      "audio:",
      "audio:0",
      "audio:-1",
      "Audio:1",
      "music:1",
      "audio:9223372036854775808",
      "9223372036854775808",
      " 1",
    ])
      expect(parseMediaId(invalid), invalid).toBeNull()
    // Astro leaves an encoded colon in route parameters.
    expect(parseMediaIdParam("audio%3A42")).toEqual({ kind: "audio", id: "42" })
    expect(parseMediaIdParam("audio:42")).toEqual({ kind: "audio", id: "42" })
    for (const invalid of [undefined, "%E0%A4%A", "audio%3A0", "%20 1"])
      expect(parseMediaIdParam(invalid), invalid).toBeNull()
  })

  it("formats playback positions for short and long sounds", () => {
    expect(formatPlaybackTime(0)).toBe("0:00")
    expect(formatPlaybackTime(65.9)).toBe("1:05")
    expect(formatPlaybackTime(3725)).toBe("1:02:05")
    expect(formatPlaybackTime(Number.NaN)).toBe("--:--")
    expect(formatPlaybackTime(Number.POSITIVE_INFINITY)).toBe("--:--")
  })

  it("handles missing files, missing configuration, and IDs owned by another bot", () => {
    expect(mediaUnavailableReason(null, token)).toContain("No saved media")
    expect(
      mediaUnavailableReason({ ...media, telegram_files: [] }, token)
    ).toContain("No saved media")
    expect(mediaUnavailableReason(media, "")).toContain(
      "temporarily unavailable"
    )
    expect(mediaUnavailableReason(media, "456:secret")).toContain("unavailable")
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
