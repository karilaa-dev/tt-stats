import { T, useTranslation } from "@/lib/i18n/provider"
import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRightIcon } from "@phosphor-icons/react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { Button } from "@/components/controls"
import { statsBreakdownQueryOptions } from "@/lib/stats/query-options"

export function DetailedPage() {
  const { t } = useTranslation()

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
        title={t("Breakdown")}
        description={t(
          "Compare download activity by audience and reporting period."
        )}
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
      <div className="section-heading">
        <div>
          <h2>
            <T>{audience}</T>
          </h2>
          <p>
            <T>{period}</T>
            <T>{" · Downloads, formats, and cache usage"}</T>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a
              href={`/dashboard/analytics${range === "24h" ? "" : `?range=${range}`}`}
            />
          }
        >
          <T>{"View activity over time "}</T>
          <ArrowUpRightIcon data-icon="inline-end" />
        </Button>
      </div>
      <T>
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
      </T>
    </>
  )
}
