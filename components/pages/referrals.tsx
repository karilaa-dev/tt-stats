import { T, useTranslation } from "@/lib/i18n/provider"
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
} from "@/components/controls"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/controls"
import { referralStatsQueryOptions } from "@/lib/stats/query-options"

export function ReferralsPage() {
  const { locale } = useTranslation()

  const { t } = useTranslation()

  const referralsQuery = useQuery(referralStatsQueryOptions())
  const rows = referralsQuery.data
  const rankedChats =
    rows?.reduce((total, row) => total + BigInt(row.count), 0n) ?? 0n
  return (
    <>
      <PageHeading
        title={t("Referrals")}
        description={t("See which referrals bring users to the bot.")}
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
                <T>{"Chats from ranked sources"}</T>
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                <T>{rankedChats.toLocaleString(locale)}</T>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                <T>{"Ranked sources"}</T>
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                <T>{rows.length}</T>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">
                <T>{"Leading referral"}</T>
              </dt>
              <dd className="mt-2 text-xl font-semibold break-all">
                {rows[0]?.value ?? "No referrals yet"}
              </dd>
            </div>
          </dl>
          <Card>
            <CardHeader>
              <CardTitle>
                <T>{"Referral ranking"}</T>
              </CardTitle>
              <CardDescription>
                <T>
                  {"Up to 10 referral sources, ranked by registered chats."}
                </T>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <T>
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
                      <EmptyTitle>
                        <T>{"No referrals yet"}</T>
                      </EmptyTitle>
                      <EmptyDescription>
                        <T>
                          {
                            "Referrals appear here when new chats register through a referral link."
                          }
                        </T>
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </T>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
