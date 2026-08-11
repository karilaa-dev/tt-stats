import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { DownloadIcon, UserRoundSearchIcon } from "lucide-react"

import { PageHeading } from "@/components/dashboard/page-heading"
import { UserLookupForm } from "@/components/dashboard/user-lookup-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import { userStatsQueryOptions } from "@/lib/stats/query-options"
import { parseTelegramId } from "@/lib/stats/validation"

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({ meta: [{ title: "User lookup · TT Stats" }] }),
  validateSearch: (search) => ({
    id: typeof search.id === "string" ? search.id : "",
  }),
  loaderDeps: ({ search: { id } }) => ({ id: id.trim() }),
  loader: ({ context, deps: { id } }) => {
    const userId = id ? parseTelegramId(id) : null
    return userId
      ? context.queryClient.ensureQueryData(userStatsQueryOptions(userId))
      : null
  },
  component: UsersPage,
})

function UsersPage() {
  const { id } = Route.useSearch()
  const requested = id.trim()
  const userId = requested ? parseTelegramId(requested) : null

  return (
    <>
      <PageHeading
        title="User lookup"
        description="Look up private users and groups without converting Telegram IDs to JavaScript numbers."
      />
      <UserLookupForm key={requested} initialId={requested} />
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
      ) : (
        <UserResult userId={userId} />
      )}
    </>
  )
}

function UserResult({ userId }: { userId: string }) {
  const { data: user } = useSuspenseQuery(userStatsQueryOptions(userId))

  if (!user) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No matching chat</EmptyTitle>
          <EmptyDescription>
            No user or group exists with ID {userId}.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono">{user.userId}</CardTitle>
        <CardDescription>
          {user.userId.startsWith("-") ? "Telegram group" : "Private user"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail
          label="Registered"
          value={
            user.registeredAt === null
              ? "Unknown"
              : new Date(user.registeredAt * 1000).toISOString()
          }
        />
        <Detail label="Language" value={user.language} />
        <Detail label="Referral" value={user.referral ?? "None"} />
        <Detail
          label="File mode"
          value={
            <Badge variant={user.fileMode ? "default" : "secondary"}>
              {user.fileMode ? "Enabled" : "Disabled"}
            </Badge>
          }
        />
        <Detail
          label="Downloads"
          value={BigInt(user.downloads).toLocaleString("en-US")}
        />
        <Detail
          label="Image albums"
          value={BigInt(user.images).toLocaleString("en-US")}
        />
        <Button
          nativeButton={false}
          render={
            <a
              href={`/api/users/${encodeURIComponent(user.userId)}/history.csv`}
            />
          }
          variant="outline"
          className="sm:col-span-2 lg:col-span-3 lg:w-fit"
        >
          <DownloadIcon data-icon="inline-start" /> Download CSV history
        </Button>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm break-all">{value}</div>
    </div>
  )
}
