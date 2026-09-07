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
        <div className="flex flex-col gap-6">
          <dl className="grid gap-5 rounded-2xl border bg-card p-6 sm:grid-cols-3 sm:gap-8">
            <div>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <FilesIcon className="size-4" aria-hidden="true" />
                Users with file mode enabled
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {BigInt(stats.fileModeUsers).toLocaleString("en-US")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Language values</dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {stats.languages.length.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">
                Most common language
              </dt>
              <dd className="mt-2 text-xl font-semibold tracking-tight">
                {stats.languages[0] ? (
                  <LanguageValue value={stats.languages[0].value} />
                ) : (
                  "No language data"
                )}
              </dd>
            </div>
          </dl>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Languages</CardTitle>
                <CardDescription>
                  How your audience is distributed by stored language.
                </CardDescription>
                <CardAction>
                  <LanguagesIcon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <RankedTable
                  rows={stats.languages}
                  valueLabel="Language"
                  countLabel="Chats"
                  page={page}
                  pageSize={PAGE_SIZE}
                  onPageChange={(nextPage) =>
                    navigate({ search: { page: nextPage } })
                  }
                  renderValue={(value) => <LanguageValue value={value} />}
                />
              </CardContent>
            </Card>
            <div className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top downloaders</CardTitle>
                  <CardDescription>
                    Private users and groups by video history count.
                  </CardDescription>
                  <CardAction>
                    <TrophyIcon
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
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
              <BotstatCard />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
