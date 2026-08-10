import type { Metadata } from "next"

import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart"
import { requireSession } from "@/lib/auth/session"
import { getCachedTimeSeries } from "@/lib/stats/cache"
import { parseStatsRange } from "@/lib/stats/validation"

export const metadata: Metadata = { title: "Analytics" }

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  await requireSession()
  const range = parseStatsRange((await searchParams).range)
  const [users, videos, music] = await Promise.all([
    getCachedTimeSeries("users", range),
    getCachedTimeSeries("videos", range),
    getCachedTimeSeries("music", range),
  ])
  return (
    <>
      <PageHeading
        title="Analytics"
        description="UTC time series with exact range boundaries and zero-filled intervals."
      />
      <StatsFilters range={range} showScope={false} />
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
