import { T, useTranslation } from "@/lib/i18n/provider"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { useAdminAccess } from "@/components/dashboard/admin-access"
import { PageHeading } from "@/components/dashboard/page-heading"
import {
  DownloadDialog,
  type SelectedDownload,
} from "@/components/dashboard/download-dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/controls"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import { getSafeDatabaseError } from "@/lib/db/errors"
import { isRequestCancelled } from "@/lib/http-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/controls"
import { Spinner } from "@/components/controls"
import { popularVideosQueryOptions } from "@/lib/media/query-options"
import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"

export function VideosPage() {
  const { locale } = useTranslation()

  const { t } = useTranslation()

  const { page: requestedPage, range } = useDashboardSearch()
  const page = Math.min(requestedPage, 1_000_000)
  const time = useBrowserTime()
  const navigate = useDashboardNavigate()
  const { authenticated } = useAdminAccess()
  const query = useQuery(popularVideosQueryOptions(page, range))
  const [selection, setSelection] = useState<SelectedDownload | null>(null)
  return (
    <>
      <PageHeading
        title={t("Most downloaded videos")}
        description={t(
          "Ranked by people who downloaded each video. Each user or group counts once in the selected period."
        )}
      />
      <StatsFilters
        range={range}
        showScope={false}
        allRangeLabel="Total"
        onRangeChange={(nextRange) => {
          setSelection(null)
          void navigate({ search: { range: nextRange, page: 1 } })
        }}
      />
      <DownloadDialog
        selection={selection}
        onClose={() => setSelection(null)}
      />
      <Card aria-busy={query.isFetching}>
        <CardHeader>
          <CardTitle>
            <T>{"Top 1,000 videos"}</T>
          </CardTitle>
          <CardDescription>
            <T>
              {
                "Each user or group counts once. Image albums and legacy downloads without a video ID are excluded."
              }
            </T>{" "}
            <T>
              {range === "24h"
                ? "24 hours through the last completed half-hour. Rankings update every five minutes."
                : range === "all"
                  ? "All recorded downloads. Rankings update daily."
                  : `${range === "7d" ? "7" : "31"} complete days in UTC. Rankings update daily.`}
            </T>
            <T>
              {query.data
                ? ` Last updated ${formatTimestamp(query.data.refreshedAt, time)}.`
                : ""}
            </T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Spinner aria-label={t("Loading top videos")} />
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                <T>
                  {isRequestCancelled(query.error)
                    ? "Loading cancelled"
                    : authenticated
                      ? getSafeDatabaseError(query.error).title
                      : "Rankings are unavailable"}
                </T>
              </AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {isRequestCancelled(query.error) ? (
                  <p>
                    <T>{"You can try again when you are ready."}</T>
                  </p>
                ) : authenticated ? (
                  <>
                    <p>
                      <T>{getSafeDatabaseError(query.error).description}</T>
                    </p>
                    <p>
                      <T>
                        {
                          "If the ranking has not been installed, open Operations, update database definitions, then wait for the selected period to refresh."
                        }
                      </T>
                    </p>
                    <a href="/dashboard/jobs" className="underline">
                      <T>{"Open Operations"}</T>
                    </a>
                  </>
                ) : (
                  <p>
                    <T>
                      {
                        "The ranking for this period is not available yet. Please try again later."
                      }
                    </T>
                  </p>
                )}
                <Button variant="outline" onClick={() => void query.refetch()}>
                  <T>{"Try again"}</T>
                </Button>
              </AlertDescription>
            </Alert>
          ) : query.data.items.length ? (
            <Table aria-label={t("Most downloaded videos")}>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T>{"Rank"}</T>
                  </TableHead>
                  <TableHead>
                    <T>{"Video ID"}</T>
                  </TableHead>
                  <TableHead>
                    <T>{"People downloaded"}</T>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item, index) => (
                  <TableRow key={item.downloadId}>
                    <TableCell>
                      <T>{(query.data.page - 1) * 20 + index + 1}</T>
                    </TableCell>
                    <TableCell className="max-w-48 sm:max-w-96">
                      <div className="flex flex-col items-start gap-2">
                        <span className="max-w-full font-mono text-sm break-all">
                          {item.videoId}
                        </span>
                        {item.hasSavedMedia ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              setSelection({
                                id: item.downloadId,
                                sharedLink: item.sharedLink,
                                mode: "media",
                              })
                            }}
                          >
                            <T>{"View media"}</T>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <T>{BigInt(item.uniqueChats).toLocaleString(locale)}</T>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  <T>{"No videos found"}</T>
                </EmptyTitle>
                <EmptyDescription>
                  <T>
                    {page > 1
                      ? "There are no more videos on this page. Return to the previous page."
                      : "Downloaded videos will appear here."}
                  </T>
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <Button
            variant="outline"
            disabled={page <= 1 || query.isFetching}
            onClick={() => void navigate({ search: { range, page: page - 1 } })}
          >
            <T>{"Previous"}</T>
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            <T>{"Page "}</T>
            <T>{query.data?.page ?? page}</T>
          </span>
          <Button
            variant="outline"
            disabled={
              !query.data?.hasMore ||
              query.isFetching ||
              query.isError ||
              page >= 1_000_000
            }
            onClick={() => void navigate({ search: { range, page: page + 1 } })}
          >
            <T>{"Next"}</T>
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
