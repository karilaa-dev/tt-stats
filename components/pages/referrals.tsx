import { useQuery } from "@tanstack/react-query"
import { Share2Icon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
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

export function ReferralsPage() {
  const referralsQuery = useQuery(referralStatsQueryOptions())
  const rows = referralsQuery.data
  return (
    <>
      <PageHeading
        title="Referrals"
        description="See which referrals bring users to your bot."
      />
      {referralsQuery.isError && !rows ? (
        <DashboardError
          error={referralsQuery.error}
          reset={() => void referralsQuery.refetch()}
        />
      ) : !rows ? (
        <DashboardLoading variant="table" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Referral ranking</CardTitle>
            <CardDescription>
              Top referrals by registered chats.
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
      )}
    </>
  )
}
