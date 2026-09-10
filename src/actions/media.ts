import { ActionError, defineAction } from "astro:actions"
import { z } from "zod"
import { isFakeDataEnabled, getFakeUserDownloads } from "@/lib/dev/fake-data"
import {
  getDownloadersRaw,
  getPopularVideosRaw,
  getStoredMedia,
} from "@/lib/media/queries"
import { describeMedia } from "@/lib/media/telegram"
import { STATS_RANGES } from "@/lib/stats/types"
import { getSafeDatabaseError } from "@/lib/db/errors"

const downloadId = z
  .string()
  .regex(/^[1-9]\d{0,18}$/u)
  .refine(
    (value) =>
      /^[1-9]\d{0,18}$/u.test(value) && BigInt(value) <= 9223372036854775807n
  )
const page = z.number().int().min(1).max(1_000_000)
function safe<Input, Output>(handler: (input: Input) => Promise<Output>) {
  return async (input: Input) => {
    try {
      return await handler(input)
    } catch (error) {
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: getSafeDatabaseError(error).description,
      })
    }
  }
}

export const getDownloadMedia = defineAction({
  input: z.object({ downloadId }),
  handler: safe(async ({ downloadId }) =>
    isFakeDataEnabled()
      ? {
          items: [],
          unavailableReason: "Saved media is unavailable in demo mode.",
        }
      : describeMedia(downloadId, await getStoredMedia(downloadId))
  ),
})

export const getDownloaders = defineAction({
  input: z.object({ downloadId, page }),
  handler: safe(async ({ downloadId, page }) => {
    if (!isFakeDataEnabled()) return getDownloadersRaw(downloadId, page)
    const source = getFakeUserDownloads("123456789", 1, 50).items.find(
      (item) => item.id === downloadId
    )
    return {
      items:
        source?.cacheHit && page === 1
          ? [
              {
                userId: "9007199254740993",
                downloads: "4",
                lastDownloadedAt: 1_800_000_000,
              },
              {
                userId: "-1009876543210",
                downloads: "2",
                lastDownloadedAt: 1_800_000_000,
              },
            ]
          : [],
      page,
      hasMore: false,
    }
  }),
})

export const getPopularVideos = defineAction({
  input: z.object({ page, range: z.enum(STATS_RANGES).default("all") }),
  handler: safe(async ({ page, range }) => {
    if (!isFakeDataEnabled()) return getPopularVideosRaw(page, undefined, range)
    const scale = { "24h": 0.1, "7d": 0.3, "31d": 0.6, all: 1 }[range]
    const items = getFakeUserDownloads("123456789", 1, 50)
      .items.filter((item) => item.mediaKind === "video")
      .map((item, index) => ({
        downloadId: item.id,
        sharedLink: item.sharedLink,
        downloads: String(Math.ceil((120 - index * 4) * scale)),
        uniqueChats: String(Math.ceil((60 - index * 2) * scale)),
      }))
    return {
      items: items.slice((page - 1) * 20, page * 20),
      page,
      hasMore: items.length > page * 20,
      refreshedAt: 1_800_000_000,
      range,
    }
  }),
})
