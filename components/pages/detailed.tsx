import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRightIcon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { Button } from "@/components/ui/button"
import { statsBreakdownQueryOptions } from "@/lib/stats/query-options"

export function DetailedPage() {
  const { scope, range } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const statsQuery = useQuery(statsBreakdownQueryOptions(scope, range))
  const audience = {
    users: "Private users",
    groups: "Groups",
    all: "All chats",
  }[scope]
  const period = {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "31d": "Last 31 days",
    all: "All time",
  }[range]
  return (
    <>
      <PageHeading
        title="Breakdown"
        description="Compare download activity by audience and reporting period."
      />
      <StatsFilters
        scope={scope}
        range={range}
        onScopeChange={(nextScope) =>
          navigate({
            search: (previous) => ({ ...previous, scope: nextScope }),
          })
        }
        onRangeChange={(nextRange) =>
          navigate({
            search: (previous) => ({ ...previous, range: nextRange }),
          })
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {audience}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {period} · Downloads, formats, and cache usage
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/dashboard/analytics?scope=${scope}&range=${range}`} />
          }
        >
          View activity over time <ArrowUpRightIcon data-icon="inline-end" />
        </Button>
      </div>
      {statsQuery.isError && !statsQuery.data ? (
        <DashboardError
          error={statsQuery.error}
          reset={() => void statsQuery.refetch()}
        />
      ) : statsQuery.data ? (
        <StatsCards stats={statsQuery.data} />
      ) : (
        <DashboardLoading />
      )}
    </>
  )
}
