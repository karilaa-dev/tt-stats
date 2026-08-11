export const CHAT_SCOPES = ["users", "groups", "all"] as const
export const STATS_RANGES = ["24h", "7d", "31d", "all"] as const
export const SERIES_METRICS = ["users", "videos", "music"] as const

export type ChatScope = (typeof CHAT_SCOPES)[number]
export type StatsRange = (typeof STATS_RANGES)[number]
export type SeriesMetric = (typeof SERIES_METRICS)[number]

export interface MetricCount {
  total: string
  uniqueUsers: string
}

export interface StatsBreakdown {
  chats: string
  music: MetricCount
  downloads: MetricCount & {
    images: string
    uniqueImageUsers: string
  }
}

export interface OverviewStats {
  users: {
    all: StatsBreakdown
    last24Hours: StatsBreakdown
  }
  groups: {
    all: StatsBreakdown
    last24Hours: StatsBreakdown
  }
  generatedAt: number
}

export interface TimeSeriesPoint {
  bucketEpoch: number
  count: number
}

export interface UserStats {
  userId: string
  registeredAt: number | null
  language: string
  referral: string | null
  fileMode: boolean
  downloads: string
  images: string
}

export interface UserDownload {
  id: string
  downloadedAt: number | null
  sharedLink: string
  mediaKind: "video" | "images"
}

export interface PaginatedUserDownloads {
  items: UserDownload[]
  page: number
  pageSize: number
  total: string
  totalPages: number
}

export interface RankedValue {
  value: string
  count: string
}

export interface OtherStats {
  fileModeUsers: string
  languages: RankedValue[]
  topDownloaders: RankedValue[]
}
