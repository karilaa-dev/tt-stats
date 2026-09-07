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
  const rankedChats =
    rows?.reduce((total, row) => total + BigInt(row.count), 0n) ?? 0n
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
        <div className="flex flex-col gap-6">
          <dl className="grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">
                Chats from ranked sources
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {rankedChats.toLocaleString("en-US")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Ranked sources</dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {rows.length}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">
                Leading referral
              </dt>
              <dd className="mt-2 text-xl font-semibold break-all">
                {rows[0]?.value ?? "No referrals yet"}
              </dd>
            </div>
          </dl>
          <Card>
            <CardHeader>
              <CardTitle>Referral ranking</CardTitle>
              <CardDescription>
                Up to 10 referral sources, ranked by registered chats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length ? (
                <RankedTable
                  rows={rows}
                  valueLabel="Referral"
                  countLabel="Registered chats"
                />
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Share2Icon />
                    </EmptyMedia>
                    <EmptyTitle>No referrals yet</EmptyTitle>
                    <EmptyDescription>
                      Referrals appear here when new chats register through a
                      referral link.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
