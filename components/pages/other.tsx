import { T, useTranslation } from "@/lib/i18n/provider"
import { useAdminAccess } from "@/components/dashboard/admin-access"
import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import { FilesIcon, LanguagesIcon, TrophyIcon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { SummaryStrip } from "@/components/dashboard/summary-strip"
import { LanguageValue } from "@/components/dashboard/language-value"
import { RankedTable } from "@/components/dashboard/ranked-table"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import { otherStatsQueryOptions } from "@/lib/stats/query-options"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

export function OtherPage() {
  const { t, locale } = useTranslation()

  const { authenticated } = useAdminAccess()
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
        title={t("Audience")}
        description={t(
          authenticated
            ? "Audience languages, download leaders, and file preferences."
            : "Audience languages and file preferences."
        )}
      />
      {statsQuery.isError && !stats ? (
        <DashboardError
          error={statsQuery.error}
          reset={() => void statsQuery.refetch()}
        />
      ) : !stats ? (
        <DashboardLoading variant="summary-table" />
      ) : (
        <>
          <SummaryStrip
            items={[
              {
                label: "Users with file mode enabled",
                value: BigInt(stats.fileModeUsers).toLocaleString(locale),
                icon: FilesIcon,
              },
              {
                label: "Language values",
                value: stats.languages.length.toLocaleString(locale),
                icon: LanguagesIcon,
              },
              {
                label: "Most common language",
                value: stats.languages[0] ? (
                  <LanguageValue value={stats.languages[0].value} />
                ) : (
                  "No language data"
                ),
                wide: true,
              },
            ]}
          />
          <div
            className={cn(
              "grid items-start gap-6",
              authenticated && "xl:grid-cols-2"
            )}
          >
            <Card>
              <CardHeader>
                <CardTitle>
                  <T>{"Languages"}</T>
                </CardTitle>
                <CardDescription>
                  <T>{"Bot audience by language."}</T>
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
                  emptyTitle="No language data"
                  emptyDescription="Languages appear here after the next daily update."
                />
              </CardContent>
            </Card>
            {authenticated ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <T>{"Top downloaders"}</T>
                  </CardTitle>
                  <CardDescription>
                    <T>{"Private users and groups by video history count."}</T>
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
                    renderValue={(value) => (
                      <a
                        className="ranking-link font-mono"
                        href={`/dashboard/users?id=${encodeURIComponent(value)}`}
                      >
                        {value}
                      </a>
                    )}
                    emptyTitle="No downloads yet"
                    emptyDescription="Download leaders appear here after the next daily update."
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </>
      )}
    </>
  )
}
