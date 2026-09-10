import { queryOptions, keepPreviousData } from "@tanstack/react-query"
import type { StatsRange } from "@/lib/stats/types"
import { actions } from "astro:actions"

export const mediaQueryOptions = (downloadId: string) =>
  queryOptions({
    queryKey: ["stats", "media", downloadId],
    queryFn: () => actions.getDownloadMedia.orThrow({ downloadId }),
    staleTime: 60_000,
  })
export const downloadersQueryOptions = (downloadId: string, page: number) =>
  queryOptions({
    queryKey: ["stats", "downloaders", downloadId, page],
    queryFn: () => actions.getDownloaders.orThrow({ downloadId, page }),
    staleTime: 60_000,
  })
export const popularVideosQueryOptions = (page: number, range: StatsRange) =>
  queryOptions({
    queryKey: ["stats", "popular-videos", range, page],
    queryFn: () => actions.getPopularVideos.orThrow({ page, range }),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 60_000,
    placeholderData: (previous) =>
      previous?.range === range ? keepPreviousData(previous) : undefined,
  })
