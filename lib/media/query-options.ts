import { noteCooldown, requestWithCooldown } from "@/lib/http-client"
import type { DownloadMedia } from "./types"
import { queryOptions, keepPreviousData } from "@tanstack/react-query"
import type { StatsRange } from "@/lib/stats/types"
import { actions } from "astro:actions"

export const mediaQueryOptions = (downloadId: string) =>
  queryOptions({
    queryKey: ["stats", "media", downloadId],
    queryFn: ({ signal }) =>
      requestWithCooldown("metadata", async () => {
        const response = await fetch(
          `/api/media/${encodeURIComponent(downloadId)}`,
          { signal }
        )
        if (response.status === 429)
          throw noteCooldown(
            "metadata",
            Number(response.headers.get("Retry-After")) || 60
          )
        if (!response.ok)
          throw new Error("Saved media is temporarily unavailable.")
        return (await response.json()) as DownloadMedia
      }),
    retry: false,
    staleTime: 60_000,
  })
export const downloadersQueryOptions = (downloadId: string, page: number) =>
  queryOptions({
    queryKey: ["stats", "downloaders", downloadId, page],
    queryFn: () =>
      requestWithCooldown("read", () =>
        actions.getDownloaders.orThrow({ downloadId, page })
      ),
    staleTime: 60_000,
  })
export const popularVideosQueryOptions = (page: number, range: StatsRange) =>
  queryOptions({
    queryKey: ["stats", "popular-videos", range, page],
    queryFn: () =>
      requestWithCooldown("read", () =>
        actions.getPopularVideos.orThrow({ page, range })
      ),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 60_000,
    placeholderData: (previous) =>
      previous?.range === range ? keepPreviousData(previous) : undefined,
  })
