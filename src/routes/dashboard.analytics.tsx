import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart"
import { timeSeriesQueryOptions } from "@/lib/stats/query-options"
import { parseStatsRange } from "@/lib/stats/validation"

export const Route = createFileRoute("/dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics · TT Stats" }] }),
  validateSearch: (search) => ({ range: parseStatsRange(search.range) }),
  loaderDeps: ({ search: { range } }) => ({ range }),
  loader: ({ context, deps: { range } }) => {
    void context.queryClient.prefetchQuery(
      timeSeriesQueryOptions("users", range)
    )
    void context.queryClient.prefetchQuery(
      timeSeriesQueryOptions("videos", range)
    )
    void context.queryClient.prefetchQuery(
      timeSeriesQueryOptions("music", range)
    )
  },
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const { range } = Route.useSearch()
  const navigate = Route.useNavigate()
  const usersQuery = useQuery(timeSeriesQueryOptions("users", range))
  const videosQuery = useQuery(timeSeriesQueryOptions("videos", range))
  const musicQuery = useQuery(timeSeriesQueryOptions("music", range))
  const queries = [usersQuery, videosQuery, musicQuery]
  const failed = queries.some((query) => query.isError && !query.data)
  const loading = queries.some((query) => !query.data)

  return (
    <>
      <PageHeading
        title="Analytics"
        description="UTC time series with exact range boundaries and zero-filled intervals."
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
          reset={() => {
            void Promise.all(queries.map((query) => query.refetch()))
          }}
        />
      ) : loading ? (
        <DashboardLoading variant="charts" />
      ) : (
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
          <TimeSeriesChart
            title="Music downloads"
            description="Music download history"
            points={musicQuery.data ?? []}
            range={range}
            color="var(--chart-3)"
          />
        </div>
      )}
    </>
  )
}
