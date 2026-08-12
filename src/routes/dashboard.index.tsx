import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { overviewQueryOptions } from "@/lib/stats/query-options"

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Overview · TT Stats" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(overviewQueryOptions())
  },
  component: OverviewPage,
})

function OverviewPage() {
  const overviewQuery = useQuery(overviewQueryOptions())
  const overview = overviewQuery.data
  return (
    <>
      <PageHeading
        title="Overview"
        description="Private users and groups through the latest completed database windows."
      />
      {overviewQuery.isError && !overview ? (
        <DashboardError
          error={overviewQuery.error}
          reset={() => void overviewQuery.refetch()}
        />
      ) : !overview ? (
        <DashboardLoading />
      ) : (
        <Tabs defaultValue="users">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="users" className="flex-1 sm:flex-none">
              Private users
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 sm:flex-none">
              Groups
            </TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6 flex flex-col gap-8">
            <section>
              <SectionHeading
                title="All time"
                description="Private-user history through the last completed UTC day"
              />
              <StatsCards stats={overview.users.all} />
            </section>
            <section>
              <SectionHeading
                title="Last 24 hours"
                description="Latest 24 completed hourly buckets"
              />
              <StatsCards stats={overview.users.last24Hours} />
            </section>
          </TabsContent>
          <TabsContent value="groups" className="mt-6 flex flex-col gap-8">
            <section>
              <SectionHeading
                title="All time"
                description="Group history through the last completed UTC day"
              />
              <StatsCards stats={overview.groups.all} />
            </section>
            <section>
              <SectionHeading
                title="Last 24 hours"
                description="Latest 24 completed hourly buckets"
              />
              <StatsCards stats={overview.groups.last24Hours} />
            </section>
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
