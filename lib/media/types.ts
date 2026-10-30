import type { DownloadPlatform, StatsRange } from "@/lib/stats/types"

export const POPULAR_RANKING_VERSION = 5

export interface DownloadMedia {
  items: {
    position: number
    /** Audio plays the sound track of the post's saved video file. */
    mediaType: "photo" | "video" | "audio"
    url: string
  }[]
  unavailableReason: string | null
}

export interface Downloaders {
  items: {
    userId: string
    downloads: string
    lastDownloadedAt: number | null
  }[]
  page: number
  hasMore: boolean
}

export interface PopularVideos {
  range: StatsRange
  platform: DownloadPlatform
  refreshedAt: number
  items: {
    downloadId: string
    sharedLink: string
    videoId: string
    platform: Exclude<DownloadPlatform, "all"> | null
    hasSavedMedia: boolean
    uniqueChats: string
    firstDownloadedAt: number | null
    lastDownloadedAt: number | null
  }[]
  page: number
  hasMore: boolean
}
