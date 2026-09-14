import { databaseRefreshInterval } from "@/lib/http-client"
import { databaseAction } from "@/lib/tasks/action"
import { trackDatabaseRequest } from "@/lib/tasks/client"
import { noteCooldown, requestWithCooldown } from "@/lib/http-client"
import type { DownloadMedia } from "./types"
import { queryOptions, keepPreviousData } from "@tanstack/react-query"
import type { StatsRange } from "@/lib/stats/types"
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
        "metadata"
      ),
    retry: false,
    staleTime: 60_000,
  })
export const downloadersQueryOptions = (downloadId: string, page: number) =>
  queryOptions({
    queryKey: ["stats", "downloaders", downloadId, page],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        databaseAction(actions.getDownloaders, { downloadId, page }, signal)
      ),
    staleTime: 60_000,
  })
export const popularVideosQueryOptions = (page: number, range: StatsRange) =>
  queryOptions({
    queryKey: ["stats", "popular-videos", range, page],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        databaseAction(actions.getPopularVideos, { page, range }, signal)
      ),
    retry: false,
    refetchInterval: databaseRefreshInterval(60_000),
    staleTime: 60_000,
    placeholderData: (previous) =>
      previous?.range === range ? keepPreviousData(previous) : undefined,
  })
