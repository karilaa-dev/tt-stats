import { T, useTranslation } from "@/lib/i18n/provider"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlayIcon, VideoCameraIcon } from "@phosphor-icons/react"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import {
  PlatformMark,
  PlatformToggle,
  platformOptions,
} from "@/components/dashboard/platform-filter"
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
  Field,
  FieldLabel,
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
  const { page, range, platform } = useDashboardSearch()
  const time = useBrowserTime()
  const navigate = useDashboardNavigate()
  const query = useQuery(popularVideosQueryOptions(page, range, platform))
  const [selection, setSelection] = useState<SelectedDownload | null>(null)
  // Never show another period's or platform's ranks under the current filters.
  const data =
    query.data?.range === range && query.data.platform === platform
      ? query.data
      : undefined
  const platformLabel = platformOptions.find(
    (option) => option.value === platform
  )!.label
  const refreshing = query.isFetching && Boolean(data)
  return (
    <>
      <PageHeading
        title={t("Top videos")}
        description={t(
          "Ranked by people who downloaded each video. Each user or group counts once in the selected period."
        )}
      />
      <div className="ranking-filters">
        <div className="stats-filters">
          <Field className="stats-filter">
            <FieldLabel>
              <T>{"Platform"}</T>
            </FieldLabel>
            <PlatformToggle
              value={platform}
              onValueChange={(nextPlatform) => {
                setSelection(null)
                void navigate({ search: { range, platform: nextPlatform } })
              }}
              aria-label={t("Download platform")}
            />
          </Field>
        </div>
        <StatsFilters
          range={range}
          showScope={false}
          onRangeChange={(nextRange) => {
            setSelection(null)
            void navigate({ search: { range: nextRange, platform } })
          }}
        />
      </div>
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
              <T>
                {platform === "all"
                  ? "Top 1,000 videos"
                  : `Top 1,000 ${platformLabel} videos`}
              </T>
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
                  "Only video downloads count: audio, image albums, and legacy downloads without a video ID are excluded."
                }
              </T>{" "}
              <T>
                {"First and last downloads are within the selected period."}
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
                        <span className="ranking-video-id">
                          {item.platform ? (
                            <PlatformMark platform={item.platform} compact />
                          ) : (
                            <VideoCameraIcon aria-hidden="true" />
                          )}
                          <span title={item.videoId}>{item.videoId}</span>
                        </span>
                        <dl className="ranking-dates">
                          {[
                            ["First download", item.firstDownloadedAt],
                            ["Last download", item.lastDownloadedAt],
                          ].map(([label, epoch]) => (
                            <div key={String(label)}>
                              <dt>
                                <T>{String(label)}</T>
                              </dt>
                              <dd>
                                {typeof epoch === "number" ? (
                                  <time
                                    dateTime={new Date(
                                      epoch * 1000
                                    ).toISOString()}
                                  >
                                    {formatTimestamp(epoch, time)}
                                  </time>
                                ) : (
                                  <T>{"Not recorded"}</T>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </TableCell>
                      <TableCell
                        className="ranking-count"
                        data-label={t("People downloaded")}
                      >
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
                                videoId: item.videoId,
                                platform: item.platform,
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
                    <VideoCameraIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    <T>{"No videos found"}</T>
                  </EmptyTitle>
                  <EmptyDescription>
                    <T>
                      {page > 1
                        ? "There are no more videos on this page. Return to the previous page."
                        : platform === "instagram"
                          ? "Downloaded Instagram videos will appear here."
                          : platform === "tiktok"
                            ? "Downloaded TikTok videos will appear here."
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
                  void navigate({
                    search: { range, platform, page: nextPage },
                  })
                }}
              />
            </CardFooter>
          ) : null}
        </Card>
      )}
    </>
  )
}
