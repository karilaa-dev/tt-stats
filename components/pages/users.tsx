import { T, useTranslation } from "@/lib/i18n/provider"
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
} from "@/components/controls"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/controls"
import { Alert, AlertTitle, AlertDescription } from "@/components/controls"
import { Button } from "@/components/controls"
import { Switch } from "@/components/controls"
import { Field, FieldLabel } from "@/components/controls"
import { Skeleton } from "@/components/controls"
import {
  ToggleGroup,
  ToggleGroupItem,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/controls"
import { Badge } from "@/components/controls"
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
  const { t } = useTranslation()

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
          title={t("My Profile")}
          description={t(
            "Your downloads and activity. Results update every five minutes."
          )}
        />
        <Empty className="mx-auto w-full max-w-xl border-solid bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRoundIcon />
            </EmptyMedia>
            <EmptyTitle>
              <T>{"See your download history"}</T>
            </EmptyTitle>
            <EmptyDescription>
              <T>
                {
                  "Log in with Telegram to see your videos, activity, and the posts you downloaded first. Your history is private."
                }
              </T>
            </EmptyDescription>
          </EmptyHeader>
          <T>
            {login && messages[login] ? (
              <p role="status" className="text-sm text-muted-foreground">
                <T>{messages[login]}</T>
              </p>
            ) : null}
          </T>
          <TelegramLoginButton />
        </Empty>
      </>
    )
  }
  if (!own && !authenticated)
    return (
      <p>
        <T>{"Admin access required."}</T>
      </p>
    )
  return (
    <>
      <PageHeading
        title={t(own ? "My Profile" : "User lookup")}
        description={t(
          own
            ? "Your downloads and activity. Results update every five minutes; reloading uses the same saved results."
            : "Download history and statistics for a user or group."
        )}
      />
      <div
        className={
          own
            ? "flex flex-col gap-6"
            : "grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
        }
      >
        <T>
          {!own ? (
            <aside aria-label={t("Lookup controls")}>
              <UserLookupForm initialId={requested} searching={false} />
            </aside>
          ) : null}
        </T>
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
                <T>
                  {requested ? "Invalid Telegram ID" : "Enter an ID to begin"}
                </T>
              </EmptyTitle>
              <EmptyDescription>
                <T>
                  {"Search for a user or group by their numeric Telegram ID."}
                </T>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </>
  )
}
function UserWorkspace({ userId, own }: { userId: string; own: boolean }) {
  const { t } = useTranslation()

  const session = useSession()
  const {
    page,
    fromDate,
    throughDate,
    mediaKind,
    discovery,
    sort,
    category,
    savedMediaOnly,
  } = useDashboardSearch()
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
    category,
    savedMediaOnly,
  }
  const historySearch = {
    fromDate,
    throughDate,
    mediaKind,
    discovery,
    sort,
    category,
    savedMediaOnly,
  }
  const userQuery = useQuery({
    queryKey: ["stats", own ? "me" : "user", userId],
    queryFn: ({ signal }) =>
      requestWithCooldown("read", () =>
        own
          ? databaseAction(actions.getMyStats, undefined, signal)
          : databaseAction(actions.getUserStats, { userId }, signal)
      ),
    staleTime: 300_000,
    refetchInterval: databaseRefreshInterval(300_000),
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
    staleTime: 300_000,
    refetchInterval: databaseRefreshInterval(300_000),
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
      aria-label={t(own ? "Your statistics" : "Chat results")}
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
            <T>{"Log out"}</T>
          </Button>
        </div>
      )}
      <div className="profile-overview">
        <T>
          {userQuery.isPending ? (
            <Skeleton
              className="h-32 w-full"
              aria-label={t("Loading user statistics")}
            />
          ) : userQuery.isError ? (
            <QueryError
              title={t("Statistics unavailable")}
              error={userQuery.error}
              retry={() => void userQuery.refetch()}
            />
          ) : user ? (
            <UserSummary user={user} />
          ) : (
            <Alert>
              <AlertTitle>
                <T>
                  {own ? "Your first download starts here" : "User not found"}
                </T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {own
                    ? "Download a video using the bot, then refresh this page. Group downloads are recorded separately."
                    : "There are no saved bot records for this ID."}
                </T>
              </AlertDescription>
            </Alert>
          )}
        </T>
        {user ? (
          <UserActivityChart
            own={own}
            userId={userId}
            initial={user.activity ?? []}
          />
        ) : null}
      </div>
      <section
        className="profile-history"
        aria-label={t("Your download history")}
      >
        <Tabs
          value={category}
          onValueChange={(value) =>
            changeFilters({ category: value as "history" | "popular" })
          }
        >
          <TabsList aria-label={t("History category")}>
            <TabsTrigger value="history">
              <T>{"Download history"}</T>
            </TabsTrigger>
            <TabsTrigger value="popular">
              <T>{"Popular downloads"}</T>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="history-toolbar">
          <div className="history-discovery-filters">
            <label className="history-select-field">
              <span>
                <T>{"Show"}</T>
              </span>
              <select
                className="history-select"
                value={discovery}
                onChange={(event) => {
                  const next = event.target.value as HistoryFilters["discovery"]
                  changeFilters({
                    discovery: next,
                  })
                }}
              >
                <option value="all">
                  <T>{"All downloads"}</T>
                </option>
                <option value="others">
                  <T>{"Downloaded by others"}</T>
                </option>
                <option value="first">
                  <T>{own ? "You were first" : "Account was first"}</T>
                </option>
              </select>
            </label>
            <label className="history-select-field">
              <span>
                <T>{"Sort"}</T>
              </span>
              <select
                className="history-select"
                value={sort}
                onChange={(event) =>
                  changeFilters({
                    sort: event.target.value as "newest" | "oldest",
                  })
                }
              >
                <option value="newest">
                  <T>{"Newest"}</T>
                </option>
                <option value="oldest">
                  <T>{"Oldest"}</T>
                </option>
              </select>
            </label>
            <ToggleGroup
              aria-label={t("Media type")}
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
              <T>
                {[
                  ["all", "All media"],
                  ["video", "Videos"],
                  ["images", "Albums"],
                ].map(([value, label]) => (
                  <ToggleGroupItem key={value} value={value}>
                    <T>{label}</T>
                  </ToggleGroupItem>
                ))}
              </T>
            </ToggleGroup>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="saved-media-only"
                checked={savedMediaOnly}
                onCheckedChange={(checked) =>
                  changeFilters({ savedMediaOnly: checked })
                }
              />
              <FieldLabel htmlFor="saved-media-only">
                <T>{"Show only records with media preview"}</T>
              </FieldLabel>
            </Field>
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
        <T>
          {discovery === "first" ? (
            <p className="text-xs text-muted-foreground">
              <T>
                {own
                  ? "Only posts you downloaded first that others also downloaded."
                  : "Only posts this account downloaded first that others also downloaded."}
              </T>
            </p>
          ) : null}
        </T>
        <HistoryDateFilter
          key={`${fromDate}:${throughDate}`}
          fromDate={fromDate}
          throughDate={throughDate}
          onApply={changeFilters}
        />
        {dateRange.error ? (
          <Alert variant="destructive">
            <AlertTitle>
              <T>{"Invalid date range"}</T>
            </AlertTitle>
            <AlertDescription>
              <T>{dateRange.error}</T>
            </AlertDescription>
          </Alert>
        ) : history.isError ? (
          <QueryError
            title={t("Download history unavailable")}
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
            category={category}
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
  const { locale } = useTranslation()

  const time = useBrowserTime()
  const timestamp = (value: number | null | undefined) =>
    value == null ? "Not recorded" : formatTimestamp(value, time)
  return (
    <Card className="profile-summary">
      <CardHeader>
        <CardTitle>
          <T>{"Download statistics"}</T>
        </CardTitle>
        <CardDescription>
          <T>{"All your recorded downloads."}</T>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="personal-metrics">
          <T>
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
                <dt>
                  <T>{label}</T>
                </dt>
                <dd>
                  <T>{BigInt(count).toLocaleString(locale)}</T>
                </dd>
              </div>
            ))}
          </T>
        </dl>
        <dl className="profile-details">
          <T>
            {[
              ["First download", timestamp(user.firstDownloadAt)],
              ["Latest download", timestamp(user.latestDownloadAt)],
              ["Joined", timestamp(user.registeredAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">
                  <T>{label}</T>
                </dt>
                <dd className="mt-1 font-medium">
                  <T>{value}</T>
                </dd>
              </div>
            ))}
          </T>
          <div>
            <dt className="text-muted-foreground">
              <T>{"Preferences"}</T>
            </dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">
                <span aria-hidden="true">
                  {getLanguagePresentation(user.language, locale).flag}
                </span>{" "}
                {getLanguagePresentation(user.language, locale).name}
              </Badge>
              <Badge variant="outline">
                <T>{user.fileMode ? "Send as file" : "Send as media"}</T>
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
  const { t } = useTranslation()

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
    refetchInterval: databaseRefreshInterval(300_000),
    retry: false,
  })
  const controls = (
    <ToggleGroup
      aria-label={t("Activity period")}
      value={[range]}
      onValueChange={(values) =>
        values[0] && setRange(values[0] as UserActivityRange)
      }
      variant="outline"
      size="sm"
    >
      <T>
        {[
          ["31d", "31 days"],
          ["90d", "90 days"],
          ["1y", "1 year"],
          ["all", "All time"],
        ].map(([value, label]) => (
          <ToggleGroupItem key={value} value={value}>
            <T>{label}</T>
          </ToggleGroupItem>
        ))}
      </T>
    </ToggleGroup>
  )
  const interval = range === "31d" ? "day" : range === "90d" ? "week" : "month"
  return (
    <TimeSeriesChart
      title={t("Download activity")}
      loading={range !== "31d" && query.isPending}
      error={
        range !== "31d" && query.isError ? (
          <QueryError
            title={t("Activity unavailable")}
            error={query.error}
            retry={() => void query.refetch()}
          />
        ) : undefined
      }
      description={t(
        interval === "month"
          ? "Downloads per month"
          : interval === "week"
            ? "Downloads per week"
            : "Downloads per day"
      )}
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
        <T>
          {"code" in error && error.code === "REQUEST_CANCELLED"
            ? "Loading cancelled"
            : title}
        </T>
      </AlertTitle>
      <AlertDescription>
        <p>
          <T>
            {"code" in error &&
            ["TOO_MANY_REQUESTS", "REQUEST_CANCELLED"].includes(
              String(error.code)
            )
              ? error.message
              : "Please try again in a moment."}
          </T>
        </p>
        <Button variant="outline" onClick={retry}>
          <T>{"Try again"}</T>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
