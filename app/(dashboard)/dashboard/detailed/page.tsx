import type { Metadata } from "next"

import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import { requireSession } from "@/lib/auth/session"
import { getCachedStatsBreakdown } from "@/lib/stats/cache"
import { parseChatScope, parseStatsRange } from "@/lib/stats/validation"

export const metadata: Metadata = { title: "Detailed" }

export default async function DetailedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; range?: string }>
}) {
  await requireSession()
  const params = await searchParams
  const scope = parseChatScope(params.scope)
  const range = parseStatsRange(params.range)
  const stats = await getCachedStatsBreakdown(scope, range)
  return (
    <>
      <PageHeading
        title="Detailed statistics"
        description="Choose a linkable chat scope and exact UTC reporting period."
      />
      <StatsFilters scope={scope} range={range} />
      <StatsCards stats={stats} />
    </>
  )
}
