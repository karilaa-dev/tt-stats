import {
  ImagesIcon,
  VideoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
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
}: {
  data?: PaginatedUserDownloads
  loading: boolean
  refreshing?: boolean
  onPageChange: (page: number) => void
  onView?: (selection: SelectedDownload) => void
  own?: boolean
  admin?: boolean
}) {
  const time = useBrowserTime()
  const first = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0
  return (
    <Card className="profile-history-card" aria-busy={loading || refreshing}>
      <CardHeader>
        <CardTitle>Download history</CardTitle>
        <CardDescription>
          Newest first. Times shown in {time.timeZone}.{" "}
          {refreshing ? <Spinner aria-label="Updating downloads" /> : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3" aria-label="Loading downloads">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : data?.items.length ? (
          <ul className="download-history" aria-label="Download history">
            {data.items.map((download) => {
              const url = safeExternalUrl(download.sharedLink)
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
                    {download.mediaKind === "images" ? (
                      <ImagesIcon />
                    ) : (
                      <VideoIcon />
                    )}
                  </span>
                  <div className="download-description">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {download.mediaKind === "images"
                          ? "Image album"
                          : "Video"}
                      </span>
                      {download.isFirstDownloader === true ? (
                        <Badge variant="secondary">
                          {own ? "You were first" : "First downloader"}
                        </Badge>
                      ) : null}
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="download-link"
                        title={label}
                      >
                        {label}
                        <span className="sr-only"> opens in a new tab</span>
                      </a>
                    ) : (
                      <p>{label}</p>
                    )}
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
                        {download.downloadedAt === null
                          ? "Unknown time"
                          : formatTimestamp(download.downloadedAt, time)}
                      </time>
                      {others !== null && others > 0n ? (
                        <span className="download-popularity">
                          {`${others.toLocaleString("en-US")} other ${others === 1n ? "person" : "people"} downloaded this`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {onView ? (
                    <div className="download-actions">
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
                        View media
                      </Button>
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
                          Other downloaders
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
              <EmptyTitle>No downloads found</EmptyTitle>
              <EmptyDescription>
                Downloads will appear here after you use the bot. If you applied
                filters, try a different period or media type.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      {data?.items.length ? (
        <CardFooter className="flex-col justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing {first}–{first + data.items.length - 1} of{" "}
            {BigInt(data.total).toLocaleString("en-US")}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={refreshing || data.page <= 1}
              aria-label="Go to previous page"
              onClick={() => onPageChange(data.page - 1)}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {data.page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={refreshing || data.page >= data.totalPages}
              aria-label="Go to next page"
              onClick={() => onPageChange(data.page + 1)}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}
