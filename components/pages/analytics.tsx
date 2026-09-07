import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { CachePerformanceCard } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart"
import { useBrowserTime } from "@/lib/browser-time"
import {
  statsBreakdownQueryOptions,
  timeSeriesQueryOptions,
} from "@/lib/stats/query-options"

export function AnalyticsPage() {
  const time = useBrowserTime()
  const { range } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const usersQuery = useQuery(timeSeriesQueryOptions("users", range))
  const videosQuery = useQuery(timeSeriesQueryOptions("videos", range))
  const musicQuery = useQuery(timeSeriesQueryOptions("music", range))
  const cacheQuery = useQuery(statsBreakdownQueryOptions("all", range))
  const queries = [usersQuery, videosQuery, musicQuery, cacheQuery]
  const failed = queries.some((query) => query.isError && !query.data)
  const loading = queries.some((query) => !query.data)

  return (
    <>
      <PageHeading
        title="Analytics"
        description={`Registrations and downloads over time. Times shown in ${time.timeZone}.`}
      />
      <StatsFilters
        range={range}
        showScope={false}
        onRangeChange={(nextRange) =>
          navigate({ search: { range: nextRange } })
        }
      />
      {failed ? (
        <DashboardError
          error={queries.find((query) => query.isError)?.error}
          reset={() => {
            void Promise.all(queries.map((query) => query.refetch()))
          }}
        />
      ) : loading ? (
        <DashboardLoading variant="charts" />
      ) : (
        <div className="flex flex-col gap-6">
          <CachePerformanceCard stats={cacheQuery.data!} />
          <div className="grid gap-6 xl:grid-cols-2">
            <TimeSeriesChart
              title="Registrations"
              description="New private users and groups"
              points={usersQuery.data ?? []}
              range={range}
              color="var(--chart-1)"
            />
            <TimeSeriesChart
              title="Video downloads"
              description="Video and image deliveries"
              points={videosQuery.data ?? []}
              range={range}
              color="var(--chart-2)"
            />
            <div className="xl:col-span-2">
              <TimeSeriesChart
                title="Music downloads"
                description="Music download history"
                points={musicQuery.data ?? []}
                range={range}
                color="var(--chart-3)"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
