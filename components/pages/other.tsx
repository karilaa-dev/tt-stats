import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import { FilesIcon, LanguagesIcon, TrophyIcon } from "lucide-react"

import { BotstatCard } from "@/components/dashboard/botstat-card"
import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { LanguageValue } from "@/components/dashboard/language-value"
import { RankedTable } from "@/components/dashboard/ranked-table"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { otherStatsQueryOptions } from "@/lib/stats/query-options"

const PAGE_SIZE = 20

export function OtherPage() {
  const statsQuery = useQuery(otherStatsQueryOptions())
  const stats = statsQuery.data
  const { page: requestedPage } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const totalPages = Math.max(
    1,
    Math.ceil((stats?.languages.length ?? 0) / PAGE_SIZE)
  )
  const page = Math.min(requestedPage, totalPages)

  return (
    <>
      <PageHeading
        title="Audience insights"
        description="Audience languages, download leaders, and file preferences."
      />
      {statsQuery.isError && !stats ? (
        <DashboardError
          error={statsQuery.error}
          reset={() => void statsQuery.refetch()}
        />
      ) : !stats ? (
        <DashboardLoading />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Users with file mode enabled</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {BigInt(stats.fileModeUsers).toLocaleString("en-US")}
              </CardTitle>
              <CardAction>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FilesIcon className="size-5" aria-hidden="true" />
                </div>
              </CardAction>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top downloaders</CardTitle>
              <CardDescription>
                Private users and groups by video history count.
              </CardDescription>
              <CardAction>
                <TrophyIcon className="size-5 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <RankedTable
                rows={stats.topDownloaders}
                valueLabel="Telegram ID"
                countLabel="Downloads"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
              <CardDescription>
                All stored language values, highest count first.
              </CardDescription>
              <CardAction>
                <LanguagesIcon className="size-5 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <RankedTable
                rows={stats.languages}
                valueLabel="Language"
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={(nextPage) =>
                  navigate({ search: { page: nextPage } })
                }
                renderValue={(value) => <LanguageValue value={value} />}
              />
            </CardContent>
          </Card>
          <BotstatCard />
        </div>
      )}
    </>
  )
}
