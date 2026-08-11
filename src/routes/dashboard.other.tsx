import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FilesIcon, LanguagesIcon, TrophyIcon } from "lucide-react"

import { BotstatCard } from "@/components/dashboard/botstat-card"
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

export const Route = createFileRoute("/dashboard/other")({
  head: () => ({ meta: [{ title: "Other stats · TT Stats" }] }),
  validateSearch: (search) => {
    const rawPage = Number(search.page)
    return {
      page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(otherStatsQueryOptions()),
  component: OtherPage,
  pendingComponent: DashboardLoading,
})

function OtherPage() {
  const { data: stats } = useSuspenseQuery(otherStatsQueryOptions())
  const { page: requestedPage } = Route.useSearch()
  const navigate = Route.useNavigate()
  const totalPages = Math.max(1, Math.ceil(stats.languages.length / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

  return (
    <>
      <PageHeading
        title="Other statistics"
        description="File mode, language distribution, top downloaders, and manual Botstat verification."
      />
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
    </>
  )
}
