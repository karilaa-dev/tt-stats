import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { statsBreakdownQueryOptions } from "@/lib/stats/query-options"

export function DetailedPage() {
  const { scope, range } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const statsQuery = useQuery(statsBreakdownQueryOptions(scope, range))
  return (
    <>
      <PageHeading
        title="Detailed statistics"
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
