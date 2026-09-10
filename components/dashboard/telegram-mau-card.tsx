import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getTelegramMau } from "@/lib/telegram/functions"
import { TELEGRAM_MAU_CHECK_INTERVAL_MS } from "@/lib/telegram/types"

export function TelegramMauCard() {
  const query = useQuery({
    queryKey: ["telegram-mau"],
    queryFn: getTelegramMau,
    staleTime: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    refetchInterval: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    retry: false,
  })
  const count = query.data?.status === "available" ? query.data.count : null

  return (
    <Card
      size="sm"
      className="overview-mau-card"
      role="region"
      aria-label="Telegram monthly active users"
    >
      <CardHeader>
        <CardTitle>Telegram MAU</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton
            className="h-9 w-24"
            aria-label="Loading monthly active users"
          />
        ) : (
          <p className="overview-mau-number" data-unavailable={count == null}>
            {count != null ? count.toLocaleString("en-US") : "Unavailable"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
