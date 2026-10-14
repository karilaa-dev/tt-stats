import { T, useTranslation } from "@/lib/i18n/provider"
import { useQuery } from "@tanstack/react-query"
import { Share2Icon, UsersIcon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { SummaryStrip } from "@/components/dashboard/summary-strip"
import { RankedTable } from "@/components/dashboard/ranked-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import { referralStatsQueryOptions } from "@/lib/stats/query-options"

export function ReferralsPage() {
  const { t, locale } = useTranslation()

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
        <DashboardLoading variant="summary-table" count={6} />
      ) : (
        <>
          <SummaryStrip
            items={[
              {
                label: "Chats from ranked sources",
                value: rankedChats.toLocaleString(locale),
                icon: UsersIcon,
              },
              {
                label: "Ranked sources",
                value: rows.length.toLocaleString(locale),
                icon: Share2Icon,
              },
              {
                label: "Leading referral",
                value: rows[0] ? (
                  <span className="font-mono">{rows[0].value}</span>
                ) : (
                  "No referrals yet"
                ),
                wide: true,
              },
            ]}
          />
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
              <RankedTable
                rows={rows}
                valueLabel="Referral"
                countLabel="Registered chats"
                emptyTitle="No referrals yet"
                emptyDescription="Referrals appear here when new chats register through a referral link."
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
