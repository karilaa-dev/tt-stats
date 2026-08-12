import "@tanstack/react-start/server-only"

import type { HistoryCsvRow } from "@/lib/csv/format"
import { bucketSecondsForRange } from "@/lib/stats/time-series"
import type {
  ChatScope,
  OtherStats,
  OverviewStats,
  PaginatedUserDownloads,
  RankedValue,
  SeriesMetric,
  SnapshotMetadata,
  StatsBreakdown,
  StatsJob,
  StatsRange,
  TimeSeriesPoint,
  UserDownload,
  UserStats,
} from "@/lib/stats/types"

const FAKE_NOW_EPOCH = 1_786_338_000

const scopeScale: Record<ChatScope, number> = {
  users: 1,
  groups: 0.16,
  all: 1.16,
}

const rangeScale: Record<StatsRange, number> = {
  "24h": 1 / 365,
  "7d": 7 / 365,
  "31d": 31 / 365,
  all: 1,
}

const fakeUsers: Record<string, UserStats> = {
  "123456789": {
    userId: "123456789",
    registeredAt: FAKE_NOW_EPOCH - 31_622_400,
    language: "en",
    referral: "telegram-channel",
    fileMode: true,
    downloads: "1842",
    images: "216",
  },
  "-1009876543210": {
    userId: "-1009876543210",
    registeredAt: FAKE_NOW_EPOCH - 12_960_000,
    language: "uk",
    referral: "group-invite",
    fileMode: false,
    downloads: "9567",
    images: "1104",
  },
  "9007199254740993": {
    userId: "9007199254740993",
    registeredAt: FAKE_NOW_EPOCH - 604_800,
    language: "de",
    referral: null,
    fileMode: false,
    downloads: "42",
    images: "7",
  },
}

const fakeHistory: HistoryCsvRow[] = [
  {
    Time: "2026-08-10T04:58:00.000Z",
    Video: "https://www.tiktok.com/@demo/video/7539876543210000001",
  },
  {
    Time: "2026-08-09T21:14:12.000Z",
    Video: "https://www.instagram.com/p/DEMO_IMAGE_ALBUM/",
  },
  {
    Time: "2026-08-08T09:02:44.000Z",
    Video: 'https://example.test/video,with-a-comma-and-"quotes"',
  },
]

const fakeDownloads: UserDownload[] = Array.from({ length: 27 }, (_, index) => {
  const images = index % 5 === 2
  return {
    id: String(10_000 - index),
    downloadedAt: FAKE_NOW_EPOCH - index * 14_417,
    sharedLink: images
      ? `https://www.instagram.com/p/DEMO_ALBUM_${String(index + 1).padStart(2, "0")}/`
      : `https://www.tiktok.com/@demo/video/${7539876543210000001n + BigInt(index)}`,
    mediaKind: images ? "images" : "video",
  }
})

export function isFakeDataEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.TT_STATS_FAKE_DATA === "true"
  )
}

function scaledCount(
  base: number,
  scope: ChatScope,
  range: StatsRange
): string {
  return Math.max(
    0,
    Math.round(base * scopeScale[scope] * rangeScale[range])
  ).toString()
}

export function getFakeStatsBreakdown(
  scope: ChatScope,
  range: StatsRange
): StatsBreakdown {
  return {
    chats: scaledCount(92_480, scope, range),
    music: {
      total: scaledCount(468_240, scope, range),
      uniqueUsers: scaledCount(38_920, scope, range),
    },
    downloads: {
      total: scaledCount(1_384_760, scope, range),
      uniqueUsers: scaledCount(81_340, scope, range),
      images: scaledCount(216_890, scope, range),
      uniqueImageUsers: scaledCount(43_680, scope, range),
    },
  }
}

export function getFakeOverview(): OverviewStats {
  return {
    users: {
      all: getFakeStatsBreakdown("users", "all"),
      last24Hours: getFakeStatsBreakdown("users", "24h"),
    },
    groups: {
      all: getFakeStatsBreakdown("groups", "all"),
      last24Hours: getFakeStatsBreakdown("groups", "24h"),
    },
    generatedAt: FAKE_NOW_EPOCH,
  }
}

export function getFakeTimeSeries(
  metric: SeriesMetric,
  range: StatsRange
): TimeSeriesPoint[] {
  const bucketSeconds = bucketSecondsForRange(range)
  const pointCount: Record<StatsRange, number> = {
    "24h": 48,
    "7d": 168,
    "31d": 31,
    all: 180,
  }
  const halfHourlyBase: Record<SeriesMetric, number> = {
    users: 7,
    videos: 96,
    music: 31,
  }
  const endBucket =
    Math.floor(FAKE_NOW_EPOCH / bucketSeconds) * bucketSeconds - bucketSeconds
  const length = pointCount[range]
  const dailyScale = bucketSeconds === 86_400 ? 21 : 1

  return Array.from({ length }, (_, index) => {
    const cycle = 0.72 + Math.sin(index / 4) * 0.2 + (index % 7) * 0.045
    return {
      bucketEpoch: endBucket - (length - index - 1) * bucketSeconds,
      count:
        index % 37 === 0
          ? 0
          : Math.max(
              0,
              Math.round(halfHourlyBase[metric] * dailyScale * cycle)
            ),
    }
  })
}

export function getFakeSnapshotMetadata(): SnapshotMetadata[] {
  const rollingEnd = Math.floor(FAKE_NOW_EPOCH / 1800) * 1800
  const dayEnd = Math.floor(FAKE_NOW_EPOCH / 86_400) * 86_400
  return [
    {
      dataset: "rolling_24h",
      refreshedAt: FAKE_NOW_EPOCH,
      windowStartEpoch: rollingEnd - 86_400,
      windowEndEpoch: rollingEnd,
    },
    {
      dataset: "daily",
      refreshedAt: FAKE_NOW_EPOCH - 18_000,
      windowStartEpoch: dayEnd - 180 * 86_400,
      windowEndEpoch: dayEnd,
    },
  ]
}

export function getFakeStatsJobs(): StatsJob[] {
  const snapshots = getFakeSnapshotMetadata()
  return [
    {
      dataset: "rolling_24h",
      jobName: "tt-stats-rolling-24h",
      schedule: "*/5 * * * *",
      active: true,
      lastStatus: "succeeded",
      lastStartedAt: FAKE_NOW_EPOCH - 8,
      lastFinishedAt: FAKE_NOW_EPOCH - 4,
      lastDurationMs: 4_200,
      snapshot: snapshots[0],
      pendingRequest: null,
    },
    {
      dataset: "daily",
      jobName: "tt-stats-daily",
      schedule: "7 0 * * *",
      active: true,
      lastStatus: "succeeded",
      lastStartedAt: FAKE_NOW_EPOCH - 18_060,
      lastFinishedAt: FAKE_NOW_EPOCH - 18_000,
      lastDurationMs: 60_000,
      snapshot: snapshots[1],
      pendingRequest: null,
    },
  ]
}

export function getFakeUserStats(userId: string): UserStats | null {
  return fakeUsers[userId] ?? null
}

export function getFakeUserDownloads(
  userId: string,
  requestedPage: number,
  pageSize: number
): PaginatedUserDownloads {
  const downloads = fakeUsers[userId] ? fakeDownloads : []
  const totalPages = Math.ceil(downloads.length / pageSize)
  const page = totalPages ? Math.min(requestedPage, totalPages) : 1
  const offset = (page - 1) * pageSize

  return {
    items: downloads.slice(offset, offset + pageSize),
    page,
    pageSize,
    total: String(downloads.length),
    totalPages,
  }
}

export function getFakeReferralStats(): RankedValue[] {
  return [
    ["telegram-channel", "18420"],
    ["friend", "12380"],
    ["tiktok-profile", "9860"],
    ["group-invite", "7450"],
    ["instagram-bio", "6120"],
    ["youtube", "4890"],
    ["partner-bot", "3710"],
    ["website", "2940"],
    ["qr-campaign", "1820"],
    ["summer-2026", "940"],
  ].map(([value, count]) => ({ value, count }))
}

export function getFakeOtherStats(): OtherStats {
  const languageCodes = [
    "en",
    "uk",
    "de",
    "es",
    "fr",
    "pl",
    "pt",
    "it",
    "tr",
    "cs",
    "nl",
    "ro",
    "id",
    "ru",
    "ar",
    "ja",
    "ko",
    "vi",
    "th",
    "sv",
    "fi",
    "da",
    "no",
    "hu",
    "el",
    "he",
    "hi",
    "sk",
    "bg",
    "lt",
  ]

  return {
    fileModeUsers: "28470",
    languages: languageCodes.map((value, index) => ({
      value,
      count: Math.max(120, 48_000 - index * 1_620).toString(),
    })),
    topDownloaders: [
      { value: "-1009876543210", count: "9567" },
      { value: "123456789", count: "1842" },
      { value: "839201756", count: "1720" },
      { value: "-1001122334455", count: "1688" },
      { value: "9007199254740993", count: "1541" },
      { value: "772510048", count: "1410" },
      { value: "-1005566778899", count: "1324" },
      { value: "631849205", count: "1298" },
      { value: "515902384", count: "1174" },
      { value: "-1004433221100", count: "1032" },
    ],
  }
}

export function getFakeBotstatUserIds(): string[] {
  return [
    "-1009876543210",
    "-1005566778899",
    "123456789",
    "839201756",
    "9007199254740993",
  ]
}

export function getFakeHistory(): HistoryCsvRow[] {
  return fakeHistory
}
