import type { StatsRange } from "@/lib/stats/types"

export const POPULAR_RANKING_VERSION = 3

export interface DownloadMedia {
  items: { position: number; mediaType: "photo" | "video"; url: string }[]
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
  refreshedAt: number
  items: {
    downloadId: string
    sharedLink: string
    videoId: string
    hasSavedMedia: boolean
    uniqueChats: string
  }[]
  page: number
  hasMore: boolean
}
