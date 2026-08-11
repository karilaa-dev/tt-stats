import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
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
import { Button } from "@/components/ui/button"
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
import {
  userDownloadsQueryOptions,
  userStatsQueryOptions,
} from "@/lib/stats/query-options"
import type { UserStats } from "@/lib/stats/types"
import { parseTelegramId } from "@/lib/stats/validation"

const DOWNLOADS_PAGE_SIZE = 8

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({ meta: [{ title: "User lookup · TT Stats" }] }),
  validateSearch: (search) => {
    const rawPage = Number(search.page)
    return {
      id: typeof search.id === "string" ? search.id : "",
      page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    }
  },
  loaderDeps: ({ search: { id, page } }) => ({ id: id.trim(), page }),
  loader: ({ context, deps: { id, page } }) => {
    const userId = id ? parseTelegramId(id) : null
    if (!userId) return

    void context.queryClient.prefetchQuery(userStatsQueryOptions(userId))
    void context.queryClient.prefetchQuery(
      userDownloadsQueryOptions(userId, page, DOWNLOADS_PAGE_SIZE)
    )
  },
  component: UsersPage,
})

function UsersPage() {
  const { id, page } = Route.useSearch()
  const navigate = Route.useNavigate()
  const requested = id.trim()
  const userId = requested ? parseTelegramId(requested) : null
  const userQuery = useQuery({
    ...userStatsQueryOptions(userId ?? "0"),
    enabled: Boolean(userId),
  })
  const downloadsQuery = useQuery({
    ...userDownloadsQueryOptions(userId ?? "0", page, DOWNLOADS_PAGE_SIZE),
    enabled: Boolean(userId),
  })

  return (
    <>
      <PageHeading
        title="User lookup"
        description="Look up private users and groups without converting Telegram IDs to JavaScript numbers."
      />
      <UserLookupForm
        initialId={requested}
        searching={Boolean(userId) && userQuery.isFetching}
      />
      {!requested ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRoundSearchIcon />
            </EmptyMedia>
            <EmptyTitle>Enter an ID to begin</EmptyTitle>
            <EmptyDescription>
              Both positive private-user IDs and negative group IDs are
              supported.
            </EmptyDescription>
          </EmptyHeader>
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
          <AlertDescription>
            The database could not complete this lookup. Try again in a moment.
          </AlertDescription>
        </Alert>
      ) : !userQuery.data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No matching chat</EmptyTitle>
            <EmptyDescription>
              No user or group exists with ID {userId}.
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
              <AlertDescription>
                The user was found, but their recent downloads could not be
                loaded.
              </AlertDescription>
            </Alert>
          ) : (
            <UserDownloadsTable
              data={downloadsQuery.data}
              loading={downloadsQuery.isPending}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-lg">{user.userId}</CardTitle>
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
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail
          icon={CalendarClockIcon}
          label="Registered"
          value={
            user.registeredAt === null
              ? "Unknown"
              : `${new Date(user.registeredAt * 1000).toLocaleString("en-GB", {
                  timeZone: "UTC",
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })} UTC`
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
        <Detail
          icon={DownloadIcon}
          label="Downloads"
          value={BigInt(user.downloads).toLocaleString("en-US")}
        />
        <Detail
          icon={ImagesIcon}
          label="Image albums"
          value={BigInt(user.images).toLocaleString("en-US")}
        />
      </CardContent>
      <CardFooter>
        <Button
          nativeButton={false}
          render={
            <a
              href={`/api/users/${encodeURIComponent(user.userId)}/history.csv`}
            />
          }
          variant="outline"
        >
          <DownloadIcon data-icon="inline-start" /> Download CSV history
        </Button>
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
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <div className="mt-1.5 text-sm font-medium break-all">{value}</div>
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
