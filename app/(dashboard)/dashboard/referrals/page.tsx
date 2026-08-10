import type { Metadata } from "next"
import { Share2Icon } from "lucide-react"

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
import { requireSession } from "@/lib/auth/session"
import { getCachedReferralStats } from "@/lib/stats/cache"

export const metadata: Metadata = { title: "Referrals" }

export default async function ReferralsPage() {
  await requireSession()
  const rows = await getCachedReferralStats()
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
