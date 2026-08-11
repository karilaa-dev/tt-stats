import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

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
  loader: ({ context, deps: { range } }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        timeSeriesQueryOptions("users", range)
      ),
      context.queryClient.ensureQueryData(
        timeSeriesQueryOptions("videos", range)
      ),
      context.queryClient.ensureQueryData(
        timeSeriesQueryOptions("music", range)
      ),
    ]),
  component: AnalyticsPage,
  pendingComponent: DashboardLoading,
})

function AnalyticsPage() {
  const { range } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: users } = useSuspenseQuery(
    timeSeriesQueryOptions("users", range)
  )
  const { data: videos } = useSuspenseQuery(
    timeSeriesQueryOptions("videos", range)
  )
  const { data: music } = useSuspenseQuery(
    timeSeriesQueryOptions("music", range)
  )

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
      <div className="grid gap-4 xl:grid-cols-2">
        <TimeSeriesChart
          title="Registrations"
          description="New private users and groups"
          points={users}
          range={range}
        />
        <TimeSeriesChart
          title="Video downloads"
          description="Video and image deliveries"
          points={videos}
          range={range}
        />
        <TimeSeriesChart
          title="Music downloads"
          description="Music download history"
          points={music}
          range={range}
        />
      </div>
    </>
  )
}
