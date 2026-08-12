import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { statsBreakdownQueryOptions } from "@/lib/stats/query-options"
import { parseChatScope, parseStatsRange } from "@/lib/stats/validation"

export const Route = createFileRoute("/dashboard/detailed")({
  head: () => ({ meta: [{ title: "Detailed · TT Stats" }] }),
  validateSearch: (search) => ({
    scope: parseChatScope(search.scope),
    range: parseStatsRange(search.range),
  }),
  loaderDeps: ({ search: { scope, range } }) => ({ scope, range }),
  loader: ({ context, deps: { scope, range } }) => {
    void context.queryClient.prefetchQuery(
      statsBreakdownQueryOptions(scope, range)
    )
  },
  component: DetailedPage,
})

function DetailedPage() {
  const { scope, range } = Route.useSearch()
  const navigate = Route.useNavigate()
  const statsQuery = useQuery(statsBreakdownQueryOptions(scope, range))
  return (
    <>
      <PageHeading
        title="Detailed statistics"
        description="Choose a linkable chat scope and completed reporting period."
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
        <DashboardError reset={() => void statsQuery.refetch()} />
      ) : statsQuery.data ? (
        <StatsCards stats={statsQuery.data} />
      ) : (
        <DashboardLoading />
      )}
    </>
  )
}
