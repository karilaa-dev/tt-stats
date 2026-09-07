import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  CalendarClockIcon,
  DownloadIcon,
  FileArchiveIcon,
  ImagesIcon,
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
  const { id, page } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const requested = id.trim()
  const userId = requested ? parseTelegramId(requested) : null
  const userQuery = useQuery({
    ...userStatsQueryOptions(userId ?? "0"),
    enabled: Boolean(userId),
  })
  const downloadsQuery = useQuery({
    ...userDownloadsQueryOptions(userId ?? "0", page, DOWNLOADS_PAGE_SIZE),
    enabled: Boolean(userId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === userId ? previousData : undefined,
  })

  return (
    <>
      <PageHeading
        title="User lookup"
        description="Investigate a chat's activity, preferences, and download history."
      />
      <UserLookupForm
        initialId={requested}
        searching={Boolean(userId) && userQuery.isFetching}
      />
      {!requested ? (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRoundSearchIcon />
            </EmptyMedia>
            <EmptyTitle>Enter an ID to begin</EmptyTitle>
            <EmptyDescription>
              Paste a Telegram user or group ID above. You'll see their chat
              profile, recent downloads, and a CSV export of their history.
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline">
              <UserIcon data-icon="inline-start" />
              Private users
            </Badge>
            <Badge variant="outline">
              <UsersIcon data-icon="inline-start" />
              Groups
            </Badge>
          </div>
        </Empty>
      ) : !userId ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Invalid Telegram ID</EmptyTitle>
            <EmptyDescription>
              Use a signed integer without spaces or decimals.
            </EmptyDescription>
          </EmptyHeader>
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
              No user or group exists with ID {userId}. Check the ID and include
              the minus sign for a group.
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
                  The user was found, but their recent downloads could not be
                  loaded.
                </p>
                <Button
                  variant="outline"
                  disabled={downloadsQuery.isFetching}
                  onClick={() => void downloadsQuery.refetch()}
                >
                  {downloadsQuery.isFetching ? "Retrying…" : "Retry history"}
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
    </>
  )
}

function UserResult({ user }: { user: UserStats }) {
  const group = user.userId.startsWith("-")
  const time = useBrowserTime()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="font-mono break-all">{user.userId}</span>
        </CardTitle>
        <CardDescription>Telegram chat profile</CardDescription>
        <CardAction>
          <Badge variant="outline">
            {group ? (
              <UsersIcon data-icon="inline-start" />
            ) : (
              <UserIcon data-icon="inline-start" />
            )}
            {group ? "Group" : "Private user"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <DownloadIcon className="size-4" aria-hidden="true" />
              Downloads
            </dt>
            <dd className="mt-2 font-heading text-3xl font-semibold tracking-tight tabular-nums">
              {BigInt(user.downloads).toLocaleString("en-US")}
            </dd>
          </div>
          <div>
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
        <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
      <CardFooter>
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
