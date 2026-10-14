import { T, useTranslation } from "@/lib/i18n/provider"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlayIcon, VideoIcon } from "lucide-react"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { PageHeading } from "@/components/dashboard/page-heading"
import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { Pager } from "@/components/dashboard/pager"
import {
  DownloadDialog,
  type SelectedDownload,
} from "@/components/dashboard/download-dialog"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/controls"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import { popularVideosQueryOptions } from "@/lib/media/query-options"
import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"

const PAGE_SIZE = 20
const MAX_PAGES = 50

export function VideosPage() {
  const { t, locale } = useTranslation()
  const { page, range } = useDashboardSearch()
  const time = useBrowserTime()
  const navigate = useDashboardNavigate()
  const query = useQuery(popularVideosQueryOptions(page, range))
  const [selection, setSelection] = useState<SelectedDownload | null>(null)
  const data = query.data?.range === range ? query.data : undefined
  const refreshing = query.isFetching && Boolean(data)
  return (
    <>
      <PageHeading
        title={t("Top videos")}
        description={t(
          "Ranked by people who downloaded each video. Each user or group counts once in the selected period."
        )}
      />
      <StatsFilters
        range={range}
        showScope={false}
        onRangeChange={(nextRange) => {
          setSelection(null)
          void navigate({ search: { range: nextRange } })
        }}
      />
      <DownloadDialog
        selection={selection}
        onClose={() => setSelection(null)}
      />
      {query.isError && !data ? (
        <DashboardError
          error={query.error}
          reset={() => void query.refetch()}
          title="Rankings are unavailable"
          description="The ranking for this period is not available yet. Please try again later."
          adminHint="If the ranking has not been installed, open Operations, update database definitions, then wait for the selected period to refresh."
        />
      ) : !data ? (
        <DashboardLoading variant="table" />
      ) : (
        <Card aria-busy={query.isFetching}>
          <CardHeader>
            <CardTitle>
              <T>{"Top 1,000 videos"}</T>
            </CardTitle>
            <CardDescription>
              <T>
                {range === "24h"
                  ? "24 hours through the last completed half-hour. Rankings update every five minutes."
                  : range === "all"
                    ? "All recorded downloads. Rankings update daily."
                    : `${range === "7d" ? "7" : "31"} complete days in UTC. Rankings update daily.`}
              </T>{" "}
              <T>{`Last updated ${formatTimestamp(data.refreshedAt, time)}.`}</T>{" "}
              <T>
                {
                  "Image albums and legacy downloads without a video ID are excluded."
                }
              </T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.items.length ? (
              <Table
                aria-label={t("Most downloaded videos")}
                className="ranking-table"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="ranking-rank">
                      <T>{"Rank"}</T>
                    </TableHead>
                    <TableHead>
                      <T>{"Video ID"}</T>
                    </TableHead>
                    <TableHead className="ranking-count">
                      <T>{"People downloaded"}</T>
                    </TableHead>
                    <TableHead className="ranking-action">
                      <span className="sr-only">
                        <T>{"Saved media"}</T>
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item, index) => (
                    <TableRow key={item.downloadId}>
                      <TableCell className="ranking-rank">
                        <Badge variant="outline" className="ranking-badge">
                          {(
                            (data.page - 1) * PAGE_SIZE +
                            index +
                            1
                          ).toLocaleString(locale)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="ranking-video-id" title={item.videoId}>
                          <VideoIcon aria-hidden="true" />
                          <span>{item.videoId}</span>
                        </span>
                      </TableCell>
                      <TableCell className="ranking-count">
                        {BigInt(item.uniqueChats).toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="ranking-action">
                        {item.hasSavedMedia ? (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={t("View media")}
                            onClick={() =>
                              setSelection({
                                id: item.downloadId,
                                sharedLink: item.sharedLink,
                                mode: "media",
                              })
                            }
                          >
                            <PlayIcon data-icon="inline-start" />
                            <span className="ranking-action-label">
                              <T>{"View media"}</T>
                            </span>
                          </Button>
                        ) : null}
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
          {data.page > 1 || data.hasMore || refreshing ? (
            <CardFooter className="card-footer-divided">
              <Pager
                className="w-full"
                page={data.page}
                hasMore={data.hasMore && data.page < MAX_PAGES}
                disabled={query.isFetching}
                label="Top videos pagination"
                summary={
                  refreshing ? (
                    <>
                      <Spinner />
                      <T>{"Updating rankings"}</T>
                    </>
                  ) : undefined
                }
                onPageChange={(nextPage) => {
                  setSelection(null)
                  void navigate({ search: { range, page: nextPage } })
                }}
              />
            </CardFooter>
          ) : null}
        </Card>
      )}
    </>
  )
}
