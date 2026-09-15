import { T, useTranslation } from "@/lib/i18n/provider"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/controls"
import { Skeleton } from "@/components/controls"
import { telegramMauQueryOptions } from "@/lib/telegram/query-options"

export function TelegramMauCard() {
  const { locale } = useTranslation()

  const { t } = useTranslation()

  const query = useQuery(telegramMauQueryOptions())
  const count = query.data?.status === "available" ? query.data.count : null

  return (
    <Card
      size="sm"
      className="overview-mau-card"
      role="region"
      aria-label={t("Telegram monthly active users")}
    >
      <CardHeader>
        <CardTitle>
          <T>{"Telegram MAU"}</T>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <T>
          {query.isPending ? (
            <Skeleton
              className="h-9 w-24"
              aria-label={t("Loading monthly active users")}
            />
          ) : (
            <p className="overview-mau-number" data-unavailable={count == null}>
              <T>
                {count != null ? count.toLocaleString(locale) : "Unavailable"}
              </T>
            </p>
          )}
        </T>
      </CardContent>
    </Card>
  )
}
