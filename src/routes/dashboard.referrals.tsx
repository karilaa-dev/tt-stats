import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Share2Icon } from "lucide-react"

import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { RankedTable } from "@/components/dashboard/ranked-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { referralStatsQueryOptions } from "@/lib/stats/query-options"

export const Route = createFileRoute("/dashboard/referrals")({
  head: () => ({ meta: [{ title: "Referrals · TT Stats" }] }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(referralStatsQueryOptions()),
  component: ReferralsPage,
  pendingComponent: DashboardLoading,
})

function ReferralsPage() {
  const { data: rows } = useSuspenseQuery(referralStatsQueryOptions())
  return (
    <>
      <PageHeading
        title="Referrals"
        description="The ten most common non-null referral values."
      />
      <Card>
        <CardHeader>
          <CardTitle>Referral ranking</CardTitle>
          <CardDescription>
            Deterministic ordering when counts are equal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <RankedTable rows={rows} valueLabel="Referral" />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Share2Icon />
                </EmptyMedia>
                <EmptyTitle>No referrals yet</EmptyTitle>
                <EmptyDescription>
                  The users table contains no referral values.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </>
  )
}
