import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Clock3Icon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { OverviewActivity } from "@/components/dashboard/overview-activity"
import { PageHeading } from "@/components/dashboard/page-heading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useDashboardNavigate,
  useDashboardSearch,
} from "@/lib/dashboard-context"
import {
  overviewQueryOptions,
  timeSeriesQueryOptions,
} from "@/lib/stats/query-options"
import { telegramMauQueryOptions } from "@/lib/telegram/query-options"

export function OverviewPage() {
  const queryClient = useQueryClient()
  const overviewQuery = useQuery(overviewQueryOptions())
  useEffect(() => {
    // These cards do not depend on the totals. Start their requests on mount
    // while keeping their own loading, error, and refresh behavior.
    void queryClient.prefetchQuery(timeSeriesQueryOptions("videos", "24h"))
    void queryClient.prefetchQuery(telegramMauQueryOptions())
  }, [queryClient])
  const overview = overviewQuery.data
  const { scope } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const audience = scope === "groups" ? "groups" : "users"

  return (
    <div className="overview-page">
      <PageHeading
        title="Overview"
        description="A little perspective on everything your bot is doing."
      />
      {overviewQuery.isError && !overview ? (
        <DashboardError
          error={overviewQuery.error}
          reset={() => void overviewQuery.refetch()}
        />
      ) : !overview ? (
        <DashboardLoading />
      ) : (
        <Tabs
          value={audience}
          onValueChange={(value) => {
            if (value === "users" || value === "groups")
              void navigate({
                search: (previous) => ({ ...previous, scope: value }),
              })
          }}
        >
          <div className="overview-toolbar">
            <TabsList
              aria-label="Overview audience"
              className="overview-audience-tabs"
            >
              <TabsTrigger value="users">Private users</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>
            <p className="overview-period">
              <Clock3Icon aria-hidden="true" /> Last 24 hours
            </p>
          </div>
          {(["users", "groups"] as const).map((value) => (
            <TabsContent value={value} key={value}>
              <OverviewActivity
                recent={overview[value].last24Hours}
                lifetime={overview[value].all}
                scope={value}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
