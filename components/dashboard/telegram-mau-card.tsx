import { useQuery } from "@tanstack/react-query"
import { UsersIcon } from "lucide-react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getTelegramMau } from "@/lib/telegram/functions"
import { TELEGRAM_MAU_CHECK_INTERVAL_MS } from "@/lib/telegram/types"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"

export function TelegramMauCard() {
  const query = useQuery({
    queryKey: ["telegram-mau"],
    queryFn: getTelegramMau,
    staleTime: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    refetchInterval: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    retry: false,
  })
  const time = useBrowserTime()
  const data = query.data
  const status = query.isError ? "unavailable" : data?.status
  const description =
    status === "not_configured"
      ? "Telegram statistics are not connected yet."
      : status === "configuration_error"
        ? "The Telegram connection needs attention from an admin."
        : status === "not_published"
          ? "Telegram has not published a count for this bot. Counts may be absent for small bots."
          : status === "unavailable"
            ? "Telegram’s count is temporarily unavailable."
            : data?.demo
              ? "Sample data for the demo workspace."
              : "Monthly active users, calculated by Telegram."
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Telegram MAU</CardTitle>
        <CardDescription>Monthly active users</CardDescription>
        <CardAction>
          <UsersIcon aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {query.isPending ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <p className="font-heading text-3xl font-semibold tabular-nums">
            {status === "available" && data?.count != null
              ? data.count.toLocaleString("en-US")
              : status === "not_configured"
                ? "Not connected"
                : status === "not_published"
                  ? "Not published"
                  : "Unavailable"}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          Checked every 12 hours. Telegram updates the count once every 24
          hours.
        </p>
        {status === "available" && data?.checkedAt ? (
          <p className="text-xs text-muted-foreground">
            Checked {formatTimestamp(data.checkedAt / 1000, time)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
