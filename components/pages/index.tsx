import { useQuery } from "@tanstack/react-query"
import { ArrowUpRightIcon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { overviewQueryOptions } from "@/lib/stats/query-options"

export function OverviewPage() {
  const overviewQuery = useQuery(overviewQueryOptions())
  const overview = overviewQuery.data
  return (
    <>
      <PageHeading
        title="Overview"
        description="Your bot's download activity and audience, at a glance."
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList
              className="w-full sm:w-fit"
              aria-label="Overview audience"
            >
              <TabsTrigger value="users" className="flex-1 sm:flex-none">
                Private users
              </TabsTrigger>
              <TabsTrigger value="groups" className="flex-1 sm:flex-none">
                Groups
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              render={<a href="/dashboard/analytics" />}
              nativeButton={false}
            >
              Explore analytics <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <TabsContent value="users" className="mt-6 flex flex-col gap-8">
            <section>
              <SectionHeading
                title="Last 24 hours"
                description="A rolling 24-hour window of completed half hours"
              />
              <StatsCards
                stats={overview.users.last24Hours}
                cacheDisplay="percentage"
              />
            </section>
            <section>
              <SectionHeading
                title="All time"
                description="Private-user history, excluding the current UTC day"
              />
              <StatsCards
                stats={overview.users.all}
                cacheDisplay="percentage"
              />
            </section>
          </TabsContent>
          <TabsContent value="groups" className="mt-6 flex flex-col gap-8">
            <section>
              <SectionHeading
                title="Last 24 hours"
                description="A rolling 24-hour window of completed half hours"
              />
              <StatsCards
                stats={overview.groups.last24Hours}
                cacheDisplay="percentage"
              />
            </section>
            <section>
              <SectionHeading
                title="All time"
                description="Group history, excluding the current UTC day"
              />
              <StatsCards
                stats={overview.groups.all}
                cacheDisplay="percentage"
              />
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
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
