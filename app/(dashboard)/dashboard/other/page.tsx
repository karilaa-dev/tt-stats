import type { Metadata } from "next"

import { BotstatCard } from "@/components/dashboard/botstat-card"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { requireSession } from "@/lib/auth/session"
import { getCachedOtherStats } from "@/lib/stats/cache"

export const metadata: Metadata = { title: "Other stats" }
const PAGE_SIZE = 20

export default async function OtherPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireSession()
  const stats = await getCachedOtherStats()
  const rawPage = Number((await searchParams).page)
  const totalPages = Math.max(1, Math.ceil(stats.languages.length / PAGE_SIZE))
  const page = Number.isInteger(rawPage)
    ? Math.min(Math.max(rawPage, 1), totalPages)
    : 1
  const languages = stats.languages.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )
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
          <CardContent className="flex flex-col gap-4">
            <RankedTable rows={languages} valueLabel="Language" />
            {totalPages > 1 ? (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={`?page=${page - 1}`}
                      aria-disabled={page === 1}
                      className={
                        page === 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href={`?page=${page + 1}`}
                      aria-disabled={page === totalPages}
                      className={
                        page === totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </CardContent>
        </Card>
        <BotstatCard />
      </div>
    </>
  )
}
