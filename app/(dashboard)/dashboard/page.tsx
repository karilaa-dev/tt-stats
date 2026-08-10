import type { Metadata } from "next"

import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireSession } from "@/lib/auth/session"
import { getCachedOverview } from "@/lib/stats/cache"

export const metadata: Metadata = { title: "Overview" }

export default async function OverviewPage() {
  await requireSession()
  const overview = await getCachedOverview()
  return (
    <>
      <PageHeading
        title="Overview"
        description="Private users and groups, all time and over the exact last 24 hours."
      />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Private users</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4 flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-medium">All time</h2>
            <StatsCards stats={overview.users.all} />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-medium">Last 24 hours</h2>
            <StatsCards stats={overview.users.last24Hours} />
          </section>
        </TabsContent>
        <TabsContent value="groups" className="mt-4 flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-medium">All time</h2>
            <StatsCards stats={overview.groups.all} />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-medium">Last 24 hours</h2>
            <StatsCards stats={overview.groups.last24Hours} />
          </section>
        </TabsContent>
      </Tabs>
    </>
  )
}
