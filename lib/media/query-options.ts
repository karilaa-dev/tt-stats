import { queryOptions, keepPreviousData } from "@tanstack/react-query"
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
export const popularVideosQueryOptions = (page: number) =>
  queryOptions({
    queryKey: ["stats", "popular-videos", page],
    queryFn: () => actions.getPopularVideos.orThrow({ page }),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
