import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { BotstatCard } from "@/components/dashboard/botstat-card"
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
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl tabular-nums">
              {BigInt(stats.fileModeUsers).toLocaleString("en-US")}
            </CardTitle>
            <CardDescription>Users with file mode enabled</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top downloaders</CardTitle>
            <CardDescription>
              Private users and groups by video history count.
            </CardDescription>
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
            />
          </CardContent>
        </Card>
        <BotstatCard />
      </div>
    </>
  )
}
