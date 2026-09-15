import { cachedQuery } from "@/lib/db/query-cache"
import { getUserStatsRaw, getUserDownloadsRaw } from "./queries"
import { getUserActivityRaw } from "./user-activity"
import { getDownloadersRaw } from "@/lib/media/queries"
import type { HistoryFilters, UserActivityRange } from "./types"
export const getCachedUserStats = (userId: string) =>
  cachedQuery("account-summary", { userId, visibility: "account" }, () =>
    getUserStatsRaw(userId)
  )
export const getCachedUserActivity = (
  userId: string,
  range: UserActivityRange
) =>
  cachedQuery(
    "account-activity",
    { userId, range, visibility: "account" },
    () => getUserActivityRaw(userId, range)
  )
export const getCachedUserDownloads = (
  userId: string,
  page: number,
  pageSize: number,
  _pool: undefined,
  filters: HistoryFilters
) =>
  cachedQuery(
    "account-history:v2",
    {
      userId,
      page,
      pageSize,
      ...filters,
      category:
        filters.sort === "popular"
          ? "popular"
          : (filters.category ?? "history"),
      sort: filters.sort === "popular" ? "newest" : filters.sort,
      visibility: "account",
    },
    () => getUserDownloadsRaw(userId, page, pageSize, undefined, filters)
  )
export const getCachedDownloaders = (downloadId: string, page: number) =>
  cachedQuery("downloaders", { downloadId, page, visibility: "admin" }, () =>
    getDownloadersRaw(downloadId, page)
  )
