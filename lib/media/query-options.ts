import { databaseRefreshInterval } from "@/lib/http-client"
import { databaseAction } from "@/lib/tasks/action"
import { trackDatabaseRequest } from "@/lib/tasks/client"
import { noteCooldown, requestWithCooldown } from "@/lib/http-client"
import type { DownloadMedia } from "./types"
import { queryOptions, keepPreviousData } from "@tanstack/react-query"
import type { DownloadPlatform, StatsRange } from "@/lib/stats/types"
import { queryKeys } from "@/lib/stats/query-keys"
import { actions } from "astro:actions"

export const mediaQueryOptions = (downloadId: string) =>
  queryOptions({
    queryKey: ["stats", "media", downloadId],
    queryFn: ({ signal }) =>
      trackDatabaseRequest(
        "Loading saved media",
        signal,
        async (id, signal) => {
          const response = await fetch(
            `/api/media/${encodeURIComponent(downloadId)}`,
            { signal, headers: { "X-Database-Task": id } }
          )
          if (response.status === 429)
            throw noteCooldown(
              "metadata",
              Number(response.headers.get("Retry-After")) || 60
            )
          if (!response.ok)
            throw new Error(
              response.status === 404
                ? "This saved download is unavailable for your account."
                : response.status === 401
                  ? "Your session has expired. Log in again to view saved media."
                  : "Saved media is temporarily unavailable. Please try again."
            )
          return (await response.json()) as DownloadMedia
        },
        "metadata",
        // The media dialog shows its own loading state and cancels on close.
        true
      ),
    retry: false,
    staleTime: 60_000,
  })
export const downloadersQueryOptions = (downloadId: string, page: number) =>
  queryOptions({
    queryKey: ["stats", "downloaders", downloadId, page],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        databaseAction(actions.getDownloaders, { downloadId, page }, signal, {
          quiet: true,
        })
      ),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    refetchInterval: databaseRefreshInterval(300_000),
  })
export const popularVideosQueryOptions = (
  page: number,
  range: StatsRange,
  platform: DownloadPlatform = "all"
) =>
  queryOptions({
    queryKey: queryKeys.popularVideos(range, page, platform),
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        databaseAction(
          actions.getPopularVideos,
          { page, range, platform },
          signal,
          { quiet: true }
        )
      ),
    retry: false,
    refetchInterval: databaseRefreshInterval(
      range === "24h" ? 300_000 : 86_400_000
    ),
    staleTime: range === "24h" ? 300_000 : 86_400_000,
    // Keep the current list while paging, never another period or platform.
    placeholderData: (previous) =>
      previous?.range === range && previous.platform === platform
        ? keepPreviousData(previous)
        : undefined,
  })
