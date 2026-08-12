import { ExternalLinkIcon, ImagesIcon, VideoIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
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
  onPageChange,
}: {
  data?: PaginatedUserDownloads
  loading: boolean
  onPageChange: (page: number) => void
}) {
  const time = useBrowserTime()
  const total = data ? BigInt(data.total).toLocaleString("en-US") : ""
  const firstItem = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0
  const lastItem = data?.items.length ? firstItem + data.items.length - 1 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest video downloads</CardTitle>
        <CardDescription>
          Newest video and image deliveries for this chat.
        </CardDescription>
        {data ? (
          <CardAction>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Downloaded</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((download) => (
                <TableRow key={download.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {download.downloadedAt === null
                      ? "Unknown"
                      : formatTimestamp(download.downloadedAt, time)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        download.mediaKind === "images"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {download.mediaKind === "images" ? (
                        <ImagesIcon data-icon="inline-start" />
                      ) : (
                        <VideoIcon data-icon="inline-start" />
                      )}
                      {download.mediaKind === "images" ? "Images" : "Video"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <a
                      href={download.sharedLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                      title={download.sharedLink}
                    >
                      <span className="truncate">
                        {linkLabel(download.sharedLink)}
                      </span>
                      <ExternalLinkIcon
                        className="shrink-0"
                        aria-hidden="true"
                      />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
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
                This chat has no video or image download history.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      {data?.items.length ? (
        <CardFooter className="flex-col justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {firstItem}–{lastItem} of {total}
          </p>
          {data.totalPages > 1 ? (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={data.page <= 1}
                    className={
                      data.page <= 1
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault()
                      onPageChange(data.page - 1)
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm text-muted-foreground tabular-nums">
                    {data.page} / {data.totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={data.page >= data.totalPages}
                    className={
                      data.page >= data.totalPages
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault()
                      onPageChange(data.page + 1)
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}
