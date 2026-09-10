import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useEffect, useRef } from "react"
import { useAdminAccess } from "@/components/dashboard/admin-access"
import { useQuery } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  CalendarClockIcon,
  DownloadIcon,
  FileArchiveIcon,
  ImagesIcon,
  HistoryIcon,
  LanguagesIcon,
  LinkIcon,
  UserIcon,
  UserRoundSearchIcon,
  UsersIcon,
} from "lucide-react"

import { LanguageValue } from "@/components/dashboard/language-value"
import { PageHeading } from "@/components/dashboard/page-heading"
import { UserDownloadsTable } from "@/components/dashboard/user-downloads-table"
import { UserLookupForm } from "@/components/dashboard/user-lookup-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import {
  userDownloadsQueryOptions,
  userStatsQueryOptions,
} from "@/lib/stats/query-options"
import type { UserStats } from "@/lib/stats/types"
import { parseTelegramId } from "@/lib/stats/validation"

const DOWNLOADS_PAGE_SIZE = 8

export function UsersPage() {
  const { authenticated, ready, requireAdmin } = useAdminAccess()
  const prompted = useRef(false)
  const { id, page } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const requested = id.trim()
  const userId = requested ? parseTelegramId(requested) : null
  useEffect(() => {
    if (userId && ready && !authenticated && !prompted.current) {
      prompted.current = true
      void requireAdmin()
    }
  }, [userId, ready, authenticated, requireAdmin])
  const userQuery = useQuery({
    ...userStatsQueryOptions(userId ?? "0"),
    enabled: authenticated && Boolean(userId),
  })
  const downloadsQuery = useQuery({
    ...userDownloadsQueryOptions(userId ?? "0", page, DOWNLOADS_PAGE_SIZE),
    enabled: authenticated && Boolean(userId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === userId ? previousData : undefined,
  })

  return (
    <>
      <PageHeading
        title="User lookup"
        description="A closer look at the people and groups using your bot."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] xl:gap-8">
        <aside
          className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-44"
          aria-label="Lookup controls"
        >
          <UserLookupForm
            initialId={requested}
            searching={Boolean(userId) && userQuery.isFetching}
          />
          <div className="hidden flex-col gap-3 px-2 lg:flex">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              About chat IDs
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Use the numeric ID from your bot's records. Usernames, phone
              numbers, and invite links can't be searched here.
            </p>
            <Separator />
            <div className="flex items-start gap-3">
              <UserIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Private users
                </span>
                <br />A positive number
              </p>
            </div>
            <div className="flex items-start gap-3">
              <UsersIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Groups</span>
                <br />A number starting with a minus sign
              </p>
            </div>
          </div>
        </aside>
        <section
          className="min-w-0"
          aria-label="Chat results"
          aria-busy={Boolean(userId) && userQuery.isPending}
        >
          {!requested ? (
            <Card>
              <Empty className="px-5 py-6 lg:min-h-80 lg:py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UserRoundSearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>Enter an ID to begin</EmptyTitle>
                  <EmptyDescription>
                    Find a chat to see their profile and what they've
                    downloaded.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              <CardFooter className="hidden justify-center gap-6 lg:flex">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <HistoryIcon className="size-4" aria-hidden="true" />
                  Download history
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DownloadIcon className="size-4" aria-hidden="true" />
                  CSV export
                </p>
              </CardFooter>
            </Card>
          ) : !userId ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Invalid Telegram ID</EmptyTitle>
                <EmptyDescription>
                  Use a signed integer without spaces or decimals.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : !authenticated ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Admin access required</EmptyTitle>
                <EmptyDescription>
                  Enter the admin token to view this chat and its download
                  history.
                </EmptyDescription>
              </EmptyHeader>
              <Button disabled={!ready} onClick={() => void requireAdmin()}>
                Enter admin token
              </Button>
            </Empty>
          ) : userQuery.isPending ? (
            <UserResultLoading />
          ) : userQuery.isError ? (
            <Alert variant="destructive">
              <UserRoundSearchIcon />
              <AlertTitle>Lookup failed</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <p>
                  The database could not complete this lookup. Try again in a
                  moment.
                </p>
                <Button
                  variant="outline"
                  disabled={userQuery.isFetching}
                  onClick={() => void userQuery.refetch()}
                >
                  {userQuery.isFetching ? "Retrying…" : "Retry lookup"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : !userQuery.data ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No matching chat</EmptyTitle>
                <EmptyDescription>
                  No user or group exists with ID {userId}. Check the ID and
                  include the minus sign for a group.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              <UserResult user={userQuery.data} />
              {downloadsQuery.isError ? (
                <Alert variant="destructive">
                  <FileArchiveIcon />
                  <AlertTitle>Download history unavailable</AlertTitle>
                  <AlertDescription className="flex flex-col items-start gap-3">
                    <p>
                      The user was found, but their recent downloads could not
                      be loaded.
                    </p>
                    <Button
                      variant="outline"
                      disabled={downloadsQuery.isFetching}
                      onClick={() => void downloadsQuery.refetch()}
                    >
                      {downloadsQuery.isFetching
                        ? "Retrying…"
                        : "Retry history"}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <UserDownloadsTable
                  data={downloadsQuery.data}
                  loading={downloadsQuery.isPending}
                  refreshing={
                    downloadsQuery.isFetching && !downloadsQuery.isPending
                  }
                  onPageChange={(nextPage) =>
                    navigate({
                      search: (previous) => ({ ...previous, page: nextPage }),
                    })
                  }
                />
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function UserResult({ user }: { user: UserStats }) {
  const group = user.userId.startsWith("-")
  const time = useBrowserTime()
  return (
    <Card>
      <CardHeader className="gap-y-2">
        <CardTitle>
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {group ? (
                <UsersIcon className="size-5" aria-hidden="true" />
              ) : (
                <UserIcon className="size-5" aria-hidden="true" />
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span>{group ? "Group" : "Private user"}</span>
              <span className="font-mono text-sm font-normal break-all text-muted-foreground">
                {user.userId}
              </span>
            </span>
          </span>
        </CardTitle>
        <CardDescription>Telegram chat profile</CardDescription>
        <CardAction>
          <Badge variant="secondary">Chat profile</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/60 p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <DownloadIcon className="size-4" aria-hidden="true" />
              Downloads
            </dt>
            <dd className="mt-2 font-heading text-3xl font-semibold tracking-tight tabular-nums">
              {BigInt(user.downloads).toLocaleString("en-US")}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImagesIcon className="size-4" aria-hidden="true" />
              Image albums
            </dt>
            <dd className="mt-2 font-heading text-3xl font-semibold tracking-tight tabular-nums">
              {BigInt(user.images).toLocaleString("en-US")}
            </dd>
          </div>
        </dl>
        <Separator />
        <dl className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          <Detail
            icon={CalendarClockIcon}
            label="Registered"
            value={
              user.registeredAt === null
                ? "Unknown"
                : formatTimestamp(user.registeredAt, time)
            }
          />
          <Detail
            icon={LanguagesIcon}
            label="Language"
            value={<LanguageValue value={user.language} />}
          />
          <Detail
            icon={LinkIcon}
            label="Referral"
            value={user.referral ?? "None"}
          />
          <Detail
            icon={FileArchiveIcon}
            label="File mode"
            value={
              <Badge variant={user.fileMode ? "default" : "secondary"}>
                {user.fileMode ? "Enabled" : "Disabled"}
              </Badge>
            }
          />
        </dl>
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <p className="hidden text-xs text-muted-foreground sm:block">
          Export this chat's full download history.
        </p>
        <a
          href={`/api/users/${encodeURIComponent(user.userId)}/history.csv`}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <DownloadIcon data-icon="inline-start" /> Download CSV history
        </a>
      </CardFooter>
    </Card>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium break-words">{value}</dd>
    </div>
  )
}

function UserResultLoading() {
  return (
    <Card aria-label="Loading user">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}
