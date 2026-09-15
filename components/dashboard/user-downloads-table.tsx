import { otherDownloaders } from "@/lib/i18n/format"
import { T, useTranslation } from "@/lib/i18n/provider"
import {
  EyeIcon,
  HeartIcon,
  ImagesIcon,
  VideoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Badge } from "@/components/controls"
import { Button } from "@/components/controls"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/controls"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/controls"
import { Skeleton } from "@/components/controls"
import { Spinner } from "@/components/controls"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import { fullPostUrl, isSharingUrl } from "@/lib/media/post-links"
import { safeExternalUrl } from "@/lib/security/links"
import type { PaginatedUserDownloads } from "@/lib/stats/types"
import type { SelectedDownload } from "./download-dialog"

export function UserDownloadsTable({
  data,
  loading,
  refreshing = false,
  onPageChange,
  onView,
  own = false,
  admin = false,
  sort = "newest",
  category = "history",
}: {
  data?: PaginatedUserDownloads
  loading: boolean
  refreshing?: boolean
  onPageChange: (page: number) => void
  onView?: (selection: SelectedDownload) => void
  own?: boolean
  admin?: boolean
  sort?: "newest" | "oldest"
  category?: "history" | "popular"
}) {
  const { locale } = useTranslation()

  const { t } = useTranslation()

  const time = useBrowserTime()
  const first = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0
  return (
    <Card className="profile-history-card" aria-busy={loading || refreshing}>
      <CardHeader>
        <CardTitle>
          <T>
            {category === "popular" ? "Popular downloads" : "Download history"}
          </T>
        </CardTitle>
        <CardDescription>
          <T>
            {category === "popular"
              ? sort === "oldest"
                ? "Most downloaded by others, oldest first for ties."
                : "Most downloaded by others, newest first for ties."
              : sort === "oldest"
                ? "Oldest first."
                : "Newest first."}
          </T>{" "}
          <T>{"Times shown in "}</T>
          <T>{time.timeZone}</T>.{" "}
          <T>
            {refreshing ? (
              <Spinner aria-label={t("Updating downloads")} />
            ) : null}
          </T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div
            className="flex flex-col gap-3"
            aria-label={t("Loading downloads")}
          >
            <T>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </T>
          </div>
        ) : data?.items.length ? (
          <ul
            className="download-history"
            aria-label={t(
              category === "popular" ? "Popular downloads" : "Download history"
            )}
          >
            {data.items.map((download) => {
              const original = safeExternalUrl(download.sharedLink)
              const post = fullPostUrl(download.canonicalUrl)
              const url =
                original && (!post || isSharingUrl(original))
                  ? original
                  : undefined
              const label = url
                ? new URL(url).hostname.replace(/^www\./u, "") +
                  new URL(url).pathname
                : "Original post unavailable"
              const others =
                download.otherUniqueChats == null
                  ? null
                  : BigInt(download.otherUniqueChats)
              return (
                <li key={download.id} className="download-entry">
                  <span className="download-kind" aria-hidden="true">
                    <T>
                      {download.mediaKind === "images" ? (
                        <ImagesIcon />
                      ) : (
                        <VideoIcon />
                      )}
                    </T>
                  </span>
                  <div className="download-description">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        <T>
                          {download.mediaKind === "images"
                            ? "Image album"
                            : "Video"}
                        </T>
                      </span>
                      <T>
                        {download.isFirstDownloader === true ? (
                          <Badge variant="secondary">
                            <T>{own ? "You were first" : "First downloader"}</T>
                          </Badge>
                        ) : null}
                      </T>
                    </div>
                    {download.videoId ? (
                      post ? (
                        <a
                          className="download-link"
                          href={post}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {download.videoId}
                          <span className="sr-only">
                            <T>{" opens in a new tab"}</T>
                          </span>
                        </a>
                      ) : (
                        <p className="download-link">{download.videoId}</p>
                      )
                    ) : null}
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={
                          download.videoId
                            ? "download-share-link"
                            : "download-link"
                        }
                        title={t(label)}
                      >
                        <T>{label}</T>
                        <span className="sr-only">
                          <T>{" opens in a new tab"}</T>
                        </span>
                      </a>
                    ) : !download.videoId ? (
                      <p>
                        <T>{label}</T>
                      </p>
                    ) : null}
                    {download.viewsDisplay?.trim() ||
                    download.likesDisplay?.trim() ? (
                      <div className="download-engagement">
                        {download.viewsDisplay?.trim() ? (
                          <span>
                            <EyeIcon aria-hidden="true" />
                            <span>
                              <T>{"Views"}</T>
                            </span>{" "}
                            <strong>{download.viewsDisplay}</strong>
                          </span>
                        ) : null}
                        {download.likesDisplay?.trim() ? (
                          <span>
                            <HeartIcon aria-hidden="true" />
                            <span>
                              <T>{"Likes"}</T>
                            </span>{" "}
                            <strong>{download.likesDisplay}</strong>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="download-context">
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={
                          download.downloadedAt == null
                            ? undefined
                            : new Date(
                                download.downloadedAt * 1000
                              ).toISOString()
                        }
                      >
                        <T>
                          {download.downloadedAt === null
                            ? "Unknown time"
                            : formatTimestamp(download.downloadedAt, time)}
                        </T>
                      </time>
                      <T>
                        {others !== null && others > 0n ? (
                          <span className="download-popularity">
                            {otherDownloaders(others, locale)}
                          </span>
                        ) : null}
                      </T>
                    </div>
                  </div>
                  {onView &&
                  (download.hasSavedMedia ||
                    (admin && download.videoDetailsId)) ? (
                    <div className="download-actions">
                      {download.hasSavedMedia ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onView({
                              id: download.id,
                              sharedLink: download.sharedLink,
                              mode: "media",
                            })
                          }
                        >
                          <T>{"View media"}</T>
                        </Button>
                      ) : null}
                      {admin && download.videoDetailsId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onView({
                              id: download.id,
                              sharedLink: download.sharedLink,
                              mode: "downloaders",
                            })
                          }
                        >
                          <T>{"Other downloaders"}</T>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                <T>{"No downloads found"}</T>
              </EmptyTitle>
              <EmptyDescription>
                <T>
                  {
                    "Downloads will appear here after you use the bot. If you applied filters, try clearing the dates or selecting all downloads."
                  }
                </T>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      <T>
        {data?.items.length ? (
          <CardFooter className="flex-col justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              <T>{"Showing "}</T>
              <T>{first}</T>–<T>{first + data.items.length - 1}</T>
              <T>{" of"}</T> <T>{BigInt(data.total).toLocaleString(locale)}</T>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={refreshing || data.page <= 1}
                aria-label={t("Go to previous page")}
                onClick={() => onPageChange(data.page - 1)}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                <T>{"Previous"}</T>
              </Button>
              <span className="text-sm text-muted-foreground">
                <T>{data.page}</T> / <T>{data.totalPages}</T>
              </span>
              <Button
                variant="outline"
                disabled={refreshing || data.page >= data.totalPages}
                aria-label={t("Go to next page")}
                onClick={() => onPageChange(data.page + 1)}
              >
                <T>{"Next"}</T>
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </T>
    </Card>
  )
}
