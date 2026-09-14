import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { actions } from "astro:actions"
import { DownloadIcon, UserRoundIcon } from "lucide-react"
import {
  useDashboardContext,
  useDashboardSearch,
  useDashboardNavigate,
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
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { parseTelegramId } from "@/lib/stats/validation"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import type { HistoryFilters, UserStats } from "@/lib/stats/types"

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
  const { page, historyRange, mediaKind } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const [selection, setSelection] = useState<SelectedDownload | null>(null)
  const filters: HistoryFilters = { range: historyRange, mediaKind }
  const userQuery = useQuery({
    queryKey: ["stats", own ? "me" : "user", userId],
    queryFn: () =>
      requestWithCooldown("read", () =>
        own
          ? actions.getMyStats.orThrow()
          : actions.getUserStats.orThrow({ userId })
      ),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })
  const history = useQuery({
    queryKey: [
      "stats",
      own ? "me" : "user",
      userId,
      "downloads",
      page,
      filters,
    ],
    queryFn: () =>
      requestWithCooldown("read", () =>
        own
          ? actions.getMyDownloads.orThrow({ page, pageSize: 20, ...filters })
          : actions.getUserDownloads.orThrow({
              userId,
              page,
              pageSize: 20,
              ...filters,
            })
      ),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
    placeholderData: (previous) => previous,
  })
  const changeFilters = (next: Partial<HistoryFilters>) => {
    setSelection(null)
    void navigate({
      search: { ...(!own ? { id: userId } : {}), ...filters, ...next, page: 1 },
    })
  }
  const user = userQuery.data
  return (
    <section
      className="flex min-w-0 flex-col gap-6"
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
          <Button variant="ghost" onClick={() => void session.logout()}>
            Log out
          </Button>
        </div>
      )}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <ToggleGroup
            aria-label="History period"
            value={[filters.range]}
            onValueChange={(value) => {
              if (value[0])
                changeFilters({ range: value[0] as HistoryFilters["range"] })
            }}
            variant="outline"
            size="sm"
          >
            {[
              ["24h", "24 hours"],
              ["7d", "7 days"],
              ["31d", "31 days"],
              ["all", "All time"],
            ].map(([value, label]) => (
              <ToggleGroupItem key={value} value={value}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
          <a
            className={buttonVariants({ variant: "outline" })}
            href={
              own
                ? "/api/me/history.csv"
                : `/api/users/${encodeURIComponent(userId)}/history.csv`
            }
          >
            <DownloadIcon data-icon="inline-start" />
            Export full history
          </a>
        ) : null}
      </div>
      {history.isError ? (
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
          onView={setSelection}
          onPageChange={(nextPage) => {
            setSelection(null)
            void navigate({
              search: {
                ...(!own ? { id: userId } : {}),
                ...filters,
                page: nextPage,
              },
            })
          }}
        />
      )}
      {user?.activity ? (
        <TimeSeriesChart
          title="Download activity"
          description="Daily downloads over the last 31 days, including today. Days are grouped in UTC."
          points={user.activity}
          range="31d"
          intervalDescription="Daily intervals, including today"
        />
      ) : null}
    </section>
  )
}
function UserSummary({ user }: { user: UserStats }) {
  const time = useBrowserTime()
  const timestamp = (value: number | null | undefined) =>
    value == null ? "Not recorded" : formatTimestamp(value, time)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Download statistics</CardTitle>
        <CardDescription>
          All recorded activity for this account.
        </CardDescription>
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
        <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
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
              <Badge variant="secondary">{user.language.toUpperCase()}</Badge>
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
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>
          {"code" in error && error.code === "TOO_MANY_REQUESTS"
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
