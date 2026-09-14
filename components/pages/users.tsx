import { databaseRefreshInterval } from "@/lib/http-client"
import { HistoryExport } from "@/components/dashboard/history-export"
import { databaseAction } from "@/lib/tasks/action"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { actions } from "astro:actions"
import { UserRoundIcon } from "lucide-react"
import {
  useDashboardContext,
  useDashboardSearch,
  useDashboardNavigate,
  useHydrated,
} from "@/lib/dashboard-context"
import { requestWithCooldown } from "@/lib/http-client"
import {
  useSession,
  TelegramLoginButton,
} from "@/components/dashboard/session-access"
import { useAdminAccess } from "@/components/dashboard/admin-access"
import {
  DownloadDialog,
  type SelectedDownload,
} from "@/components/dashboard/download-dialog"
import { UserDownloadsTable } from "@/components/dashboard/user-downloads-table"
import { HistoryDateFilter } from "@/components/dashboard/history-date-filter"
import { historyDateRange } from "@/lib/history-date-range"
import { UserLookupForm } from "@/components/dashboard/user-lookup-form"
import { TelegramChatCard } from "@/components/dashboard/telegram-chat-card"
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart"
import { PageHeading } from "@/components/dashboard/page-heading"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { parseTelegramId } from "@/lib/stats/validation"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import { getLanguagePresentation } from "@/lib/language"
import type {
  HistoryFilters,
  UserStats,
  UserActivityRange,
  TimeSeriesPoint,
} from "@/lib/stats/types"

export function UsersPage({ own = false }: { own?: boolean }) {
  const session = useSession()
  const { authenticated } = useAdminAccess()
  const { id } = useDashboardSearch()
  const { search } = useDashboardContext()
  const requested = own ? (session.user?.id ?? "") : id.trim()
  const userId = parseTelegramId(requested)
  if (own && !session.user) {
    const login = new URLSearchParams(search).get("login")
    const messages: Record<string, string> = {
      cancelled:
        "Login was cancelled. You can try again whenever you're ready.",
      expired: "That login link expired. Start a new login below.",
      failed: "Telegram login could not be verified. Please try again.",
      unavailable:
        "Telegram login is temporarily unavailable. Please try again later.",
    }
    return (
      <>
        <PageHeading
          title="My Profile"
          description="Your downloads, all in one place."
        />
        <Card className="mx-auto w-full max-w-xl">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserRoundIcon />
              </EmptyMedia>
              <EmptyTitle>See your download history</EmptyTitle>
              <EmptyDescription>
                Log in with Telegram to see your videos, activity, and the posts
                you downloaded first. Your history is private.
              </EmptyDescription>
            </EmptyHeader>
            {login && messages[login] ? (
              <p role="status" className="text-sm text-muted-foreground">
                {messages[login]}
              </p>
            ) : null}
            <TelegramLoginButton />
          </Empty>
        </Card>
      </>
    )
  }
  if (!own && !authenticated) return <p>Admin access required.</p>
  return (
    <>
      <PageHeading
        title={own ? "My Profile" : "User lookup"}
        description={
          own
            ? "Revisit your downloads and see what caught on."
            : "Download history and statistics for a user or group."
        }
      />
      <div
        className={
          own
            ? "flex flex-col gap-6"
            : "grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
        }
      >
        {!own ? (
          <aside aria-label="Lookup controls">
            <UserLookupForm initialId={requested} searching={false} />
          </aside>
        ) : null}
        {userId ? (
          <UserWorkspace
            key={`${own}:${userId}:${session.admin}`}
            userId={userId}
            own={own}
          />
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>
                {requested ? "Invalid Telegram ID" : "Enter an ID to begin"}
              </EmptyTitle>
              <EmptyDescription>
                Search for a user or group by their numeric Telegram ID.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </>
  )
}
function UserWorkspace({ userId, own }: { userId: string; own: boolean }) {
  const session = useSession()
  const { page, fromDate, throughDate, mediaKind, discovery, sort } =
    useDashboardSearch()
  const hydrated = useHydrated()
  const navigate = useDashboardNavigate()
  const [selection, setSelection] = useState<SelectedDownload | null>(null)
  const dateRange = historyDateRange(fromDate, throughDate)
  const filters: HistoryFilters = {
    from: dateRange.from,
    until: dateRange.until,
    mediaKind,
    discovery,
    sort,
  }
  const historySearch = { fromDate, throughDate, mediaKind, discovery, sort }
  const userQuery = useQuery({
    queryKey: ["stats", own ? "me" : "user", userId],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        own
          ? databaseAction(actions.getMyStats, undefined, signal)
          : databaseAction(actions.getUserStats, { userId }, signal)
      ),
    staleTime: 60_000,
    refetchInterval: databaseRefreshInterval(60_000),
    retry: false,
  })
  const history = useQuery({
    enabled: hydrated && !dateRange.error,
    queryKey: [
      "stats",
      own ? "me" : "user",
      userId,
      "downloads",
      page,
      filters,
    ],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        own
          ? databaseAction(
              actions.getMyDownloads,
              { page, pageSize: 20, ...filters },
              signal
            )
          : databaseAction(
              actions.getUserDownloads,
              {
                userId,
                page,
                pageSize: 20,
                ...filters,
              },
              signal
            )
      ),
    staleTime: 60_000,
    refetchInterval: databaseRefreshInterval(60_000),
    retry: false,
    placeholderData: (previous) => previous,
  })
  const changeFilters = (next: Partial<typeof historySearch>) => {
    setSelection(null)
    void navigate({
      search: {
        ...(!own ? { id: userId } : {}),
        ...historySearch,
        ...next,
        page: 1,
      },
    })
  }
  const user = userQuery.data
  return (
    <section
      className="profile-workspace"
      aria-label={own ? "Your statistics" : "Chat results"}
    >
      <DownloadDialog
        selection={selection}
        onClose={() => setSelection(null)}
      />
      {!own ? (
        <TelegramChatCard chatId={userId} />
      ) : (
        <div className="personal-profile">
          <div className="profile-identity">
            <span className="profile-avatar" aria-hidden="true">
              <UserRoundIcon />
            </span>
            <div>
              <h2 className="font-heading text-xl font-semibold">
                {session.user?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {session.user?.username
                  ? `@${session.user.username}`
                  : "Your Telegram account"}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => void session.logout()}>
            Log out
          </Button>
        </div>
      )}
      <div className="profile-overview">
        {userQuery.isPending ? (
          <Skeleton
            className="h-32 w-full"
            aria-label="Loading user statistics"
          />
        ) : userQuery.isError ? (
          <QueryError
            title="Statistics unavailable"
            error={userQuery.error}
            retry={() => void userQuery.refetch()}
          />
        ) : user ? (
          <UserSummary user={user} />
        ) : (
          <Alert>
            <AlertTitle>
              {own ? "Your first download starts here" : "User not found"}
            </AlertTitle>
            <AlertDescription>
              {own
                ? "Download a video using the bot, then refresh this page. Group downloads are recorded separately."
                : "There are no saved bot records for this ID."}
            </AlertDescription>
          </Alert>
        )}
        {user ? (
          <UserActivityChart
            own={own}
            userId={userId}
            initial={user.activity ?? []}
          />
        ) : null}
      </div>
      <section className="profile-history" aria-label="Your download history">
        <div className="history-toolbar">
          <div className="history-discovery-filters">
            <label className="history-select-field">
              <span>Show</span>
              <select
                className="history-select"
                value={discovery}
                onChange={(event) => {
                  const next = event.target.value as HistoryFilters["discovery"]
                  changeFilters({
                    discovery: next,
                    sort: next === "all" ? "newest" : "popular",
                  })
                }}
              >
                <option value="all">All downloads</option>
                <option value="others">Downloaded by others</option>
                <option value="first">
                  {own ? "You were first" : "Account was first"}
                </option>
              </select>
            </label>
            <label className="history-select-field">
              <span>Sort</span>
              <select
                className="history-select"
                value={sort}
                onChange={(event) =>
                  changeFilters({
                    sort: event.target.value as HistoryFilters["sort"],
                  })
                }
              >
                <option value="newest">Newest first</option>
                <option value="popular">Most downloaded by others</option>
              </select>
            </label>
            <ToggleGroup
              aria-label="Media type"
              value={[mediaKind]}
              onValueChange={(value) => {
                if (value[0])
                  changeFilters({
                    mediaKind: value[0] as HistoryFilters["mediaKind"],
                  })
              }}
              variant="outline"
              size="sm"
            >
              {[
                ["all", "All media"],
                ["video", "Videos"],
                ["images", "Albums"],
              ].map(([value, label]) => (
                <ToggleGroupItem key={value} value={value}>
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {user ? (
            <HistoryExport
              userId={userId}
              href={
                own
                  ? "/api/me/history.csv"
                  : `/api/users/${encodeURIComponent(userId)}/history.csv`
              }
            />
          ) : null}
        </div>
        {discovery === "first" ? (
          <p className="text-xs text-muted-foreground">
            {own
              ? "Only posts you downloaded first that others also downloaded."
              : "Only posts this account downloaded first that others also downloaded."}
          </p>
        ) : null}
        <HistoryDateFilter
          key={`${fromDate}:${throughDate}`}
          fromDate={fromDate}
          throughDate={throughDate}
          onApply={changeFilters}
        />
        {dateRange.error ? (
          <Alert variant="destructive">
            <AlertTitle>Invalid date range</AlertTitle>
            <AlertDescription>{dateRange.error}</AlertDescription>
          </Alert>
        ) : history.isError ? (
          <QueryError
            title="Download history unavailable"
            error={history.error}
            retry={() => void history.refetch()}
          />
        ) : (
          <UserDownloadsTable
            own={own}
            admin={session.admin}
            data={history.data}
            loading={history.isPending}
            refreshing={history.isFetching && !history.isPending}
            sort={sort}
            onView={setSelection}
            onPageChange={(nextPage) => {
              setSelection(null)
              void navigate({
                search: {
                  ...(!own ? { id: userId } : {}),
                  ...historySearch,
                  page: nextPage,
                },
              })
            }}
          />
        )}
      </section>
    </section>
  )
}
function UserSummary({ user }: { user: UserStats }) {
  const time = useBrowserTime()
  const timestamp = (value: number | null | undefined) =>
    value == null ? "Not recorded" : formatTimestamp(value, time)
  return (
    <Card className="profile-summary">
      <CardHeader>
        <CardTitle>Download statistics</CardTitle>
        <CardDescription>All your recorded downloads.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="personal-metrics">
          {[
            ["Downloads", user.downloads],
            [
              "Videos",
              (BigInt(user.downloads) - BigInt(user.images)).toString(),
            ],
            ["Image albums", user.images],
            ["Unique videos", user.uniqueVideos ?? "0"],
          ].map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{BigInt(count).toLocaleString("en-US")}</dd>
            </div>
          ))}
        </dl>
        <dl className="profile-details">
          {[
            ["First download", timestamp(user.firstDownloadAt)],
            ["Latest download", timestamp(user.latestDownloadAt)],
            ["Joined", timestamp(user.registeredAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-medium">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-foreground">Preferences</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {getLanguagePresentation(user.language).name}
              </Badge>
              <Badge variant="outline">
                {user.fileMode ? "Send as file" : "Send as media"}
              </Badge>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function UserActivityChart({
  own,
  userId,
  initial,
}: {
  own: boolean
  userId: string
  initial: TimeSeriesPoint[]
}) {
  const [range, setRange] = useState<UserActivityRange>("31d")
  const query = useQuery({
    queryKey: ["stats", own ? "me" : "user", userId, "activity", range],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        own
          ? databaseAction(actions.getMyActivity, { range }, signal)
          : databaseAction(actions.getUserActivity, { userId, range }, signal)
      ),
    enabled: range !== "31d",
    staleTime: 300_000,
    retry: false,
  })
  const controls = (
    <ToggleGroup
      aria-label="Activity period"
      value={[range]}
      onValueChange={(values) =>
        values[0] && setRange(values[0] as UserActivityRange)
      }
      variant="outline"
      size="sm"
    >
      {[
        ["31d", "31 days"],
        ["90d", "90 days"],
        ["1y", "1 year"],
        ["all", "All time"],
      ].map(([value, label]) => (
        <ToggleGroupItem key={value} value={value}>
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
  if (range !== "31d" && (query.isPending || query.isError))
    return (
      <Card className="profile-activity-card">
        <CardHeader>
          <CardTitle>Download activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {controls}
          {query.isError ? (
            <QueryError
              title="Activity unavailable"
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <Skeleton
              className="h-64 w-full"
              aria-label="Loading download activity"
            />
          )}
        </CardContent>
      </Card>
    )
  const interval = range === "31d" ? "day" : (query.data?.interval ?? "month")
  return (
    <TimeSeriesChart
      title="Download activity"
      description={
        interval === "month"
          ? "Downloads per month"
          : interval === "week"
            ? "Downloads per week"
            : "Downloads per day"
      }
      intervalDescription="UTC, including the current period"
      points={range === "31d" ? initial : (query.data?.points ?? [])}
      range={interval === "month" ? "all" : "31d"}
      calendarUnit={interval}
      compact
      controls={controls}
    />
  )
}
function QueryError({
  title,
  error,
  retry,
}: {
  title: string
  error: Error
  retry: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>
        {"code" in error && error.code === "REQUEST_CANCELLED"
          ? "Loading cancelled"
          : title}
      </AlertTitle>
      <AlertDescription>
        <p>
          {"code" in error &&
          ["TOO_MANY_REQUESTS", "REQUEST_CANCELLED"].includes(
            String(error.code)
          )
            ? error.message
            : "Please try again in a moment."}
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
