import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeading } from "@/components/dashboard/page-heading"
import {
  DownloadDialog,
  type SelectedDownload,
} from "@/components/dashboard/download-dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import { getSafeDatabaseError } from "@/lib/db/errors"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { popularVideosQueryOptions } from "@/lib/media/query-options"
import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"

export function VideosPage() {
  const { page: requestedPage } = useDashboardSearch()
  const page = Math.min(requestedPage, 1_000_000)
  const time = useBrowserTime()
  const navigate = useDashboardNavigate()
  const query = useQuery(popularVideosQueryOptions(page))
  const [selection, setSelection] = useState<SelectedDownload | null>(null)
  return (
    <>
      <PageHeading
        title="Most downloaded videos"
        description="All-time downloads, ranked from most to least. Repeated downloads by the same chat count each time."
      />
      <DownloadDialog
        selection={selection}
        onClose={() => setSelection(null)}
      />
      <Card aria-busy={query.isFetching}>
        <CardHeader>
          <CardTitle>Top 1,000 videos</CardTitle>
          <CardDescription>
            Includes cache hits and misses. Older records without a video
            identity are grouped by their exact saved link. Image albums are
            excluded. Rankings update daily.
            {query.data
              ? ` Last updated ${formatTimestamp(query.data.refreshedAt, time)}.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Spinner aria-label="Loading top videos" />
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertTitle>{getSafeDatabaseError(query.error).title}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <p>{getSafeDatabaseError(query.error).description}</p>
                <p>
                  If the ranking has not been installed, open Operations, update
                  database definitions, then wait for the daily refresh to
                  finish.
                </p>
                <a href="/dashboard/jobs" className="underline">
                  Open Operations
                </a>
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : query.data.items.length ? (
            <Table aria-label="Most downloaded videos">
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Unique chats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item, index) => (
                  <TableRow key={item.downloadId}>
                    <TableCell>
                      {(query.data.page - 1) * 20 + index + 1}
                    </TableCell>
                    <TableCell className="max-w-48 sm:max-w-96">
                      <div className="flex flex-col items-start gap-2">
                        <a
                          className="block max-w-full truncate text-primary underline"
                          href={item.sharedLink}
                          target="_blank"
                          rel="noreferrer"
                          title={item.sharedLink}
                        >
                          {item.sharedLink}
                          <span className="sr-only"> opens in a new tab</span>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelection({
                              id: item.downloadId,
                              sharedLink: item.sharedLink,
                              mode: "media",
                            })
                          }
                        >
                          View media
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {BigInt(item.downloads).toLocaleString("en-US")}
                    </TableCell>
                    <TableCell>
                      {BigInt(item.uniqueChats).toLocaleString("en-US")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No videos found</EmptyTitle>
                <EmptyDescription>
                  {page > 1
                    ? "There are no more videos on this page. Return to the previous page."
                    : "Downloaded videos will appear here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <Button
            variant="outline"
            disabled={page <= 1 || query.isFetching}
            onClick={() => void navigate({ search: { page: page - 1 } })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Page {query.data?.page ?? page}
          </span>
          <Button
            variant="outline"
            disabled={
              !query.data?.hasMore ||
              query.isFetching ||
              query.isError ||
              page >= 1_000_000
            }
            onClick={() => void navigate({ search: { page: page + 1 } })}
          >
            Next
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
