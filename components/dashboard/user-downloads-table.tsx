import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  ImagesIcon,
  VideoIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import type { SelectedDownload } from "./download-dialog"
import type { PaginatedUserDownloads } from "@/lib/stats/types"

function linkLabel(link: string): string {
  try {
    const url = new URL(link)
    return `${url.hostname.replace(/^www\./u, "")}${url.pathname}`
  } catch {
    return link
  }
}

export function UserDownloadsTable({
  data,
  loading,
  refreshing = false,
  onPageChange,
  onView,
}: {
  data?: PaginatedUserDownloads
  loading: boolean
  refreshing?: boolean
  onView?: (selection: SelectedDownload) => void
  onPageChange: (page: number) => void
}) {
  const time = useBrowserTime()
  const total = data ? BigInt(data.total).toLocaleString("en-US") : ""
  const firstItem = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0
  const lastItem = data?.items.length ? firstItem + data.items.length - 1 : 0

  return (
    <Card aria-busy={loading || refreshing}>
      <CardHeader>
        <CardTitle>Download history</CardTitle>
        <CardDescription>
          Newest first. Times shown in {time.timeZone}.
        </CardDescription>
        {data ? (
          <CardAction className="flex items-center gap-2">
            {refreshing ? <Spinner aria-label="Updating downloads" /> : null}
            <Badge variant="secondary">{total} total</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3" aria-label="Loading downloads">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.items.length ? (
          <Table aria-label="Download history">
            <TableHeader>
              <TableRow>
                <TableHead>Downloaded media</TableHead>
                <TableHead>Cache</TableHead>
                <TableHead className="hidden md:table-cell">
                  Downloaded
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((download) => (
                <TableRow key={download.id}>
                  <TableCell className="max-w-48 py-3 sm:max-w-72">
                    <div className="flex items-center gap-3">
                      <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:flex">
                        {download.mediaKind === "images" ? (
                          <ImagesIcon className="size-4" aria-hidden="true" />
                        ) : (
                          <VideoIcon className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <a
                          href={download.sharedLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-8 items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                          title={download.sharedLink}
                        >
                          <span className="truncate">
                            {linkLabel(download.sharedLink)}
                          </span>
                          <ExternalLinkIcon
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                        <p className="text-xs whitespace-normal text-muted-foreground">
                          <span>
                            {download.mediaKind === "images"
                              ? "Images"
                              : "Video"}
                          </span>
                          <span className="md:hidden">
                            {" · "}
                            {download.downloadedAt === null
                              ? "Unknown time"
                              : formatTimestamp(download.downloadedAt, time)}
                          </span>
                        </p>
                        {onView ? (
                          <div className="mt-2 flex flex-wrap gap-2">
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
                            {download.cacheHit && download.videoDetailsId ? (
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
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={download.cacheHit ? "secondary" : "outline"}
                    >
                      {download.cacheHit ? "Hit" : "Miss"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-muted-foreground tabular-nums">
                      {download.downloadedAt === null
                        ? "Unknown"
                        : formatTimestamp(download.downloadedAt, time)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <VideoIcon />
              </EmptyMedia>
              <EmptyTitle>No downloads yet</EmptyTitle>
              <EmptyDescription>
                This chat has no video or image download history. Downloads will
                appear here after the chat uses the bot.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      {data?.items.length ? (
        <CardFooter className="flex-col justify-between gap-3 sm:flex-row">
          <p
            className="text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            Showing {firstItem}–{lastItem} of {total}
          </p>
          {data.totalPages > 1 ? (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="h-10"
                    aria-label="Go to previous page"
                    disabled={loading || refreshing || data.page <= 1}
                    onClick={() => onPageChange(data.page - 1)}
                  >
                    <ChevronLeftIcon data-icon="inline-start" />
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm text-muted-foreground tabular-nums">
                    {data.page} / {data.totalPages.toLocaleString("en-US")}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="h-10"
                    aria-label="Go to next page"
                    disabled={
                      loading || refreshing || data.page >= data.totalPages
                    }
                    onClick={() => onPageChange(data.page + 1)}
                  >
                    Next
                    <ChevronRightIcon data-icon="inline-end" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}
