import { T, useTranslation } from "@/lib/i18n/provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
import { Skeleton } from "@/components/controls"
import { Spinner } from "@/components/controls"
import { cn } from "@/lib/utils"

export function DashboardLoading({
  variant = "cards",
}: {
  variant?: "cards" | "charts" | "table"
}) {
  const { t } = useTranslation()

  const count = variant === "charts" ? 4 : variant === "table" ? 1 : 6

  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label={t("Loading dashboard data")}
    >
      <Alert>
        <Spinner />
        <AlertTitle>
          <T>{"Loading the latest statistics"}</T>
        </AlertTitle>
        <AlertDescription>
          <T>
            {
              "Navigation and filters remain available while data refreshes in the background."
            }
          </T>
        </AlertDescription>
      </Alert>
      <div
        className={cn(
          "grid gap-4",
          variant === "charts"
            ? "xl:grid-cols-2"
            : variant === "cards"
              ? "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
              : undefined
        )}
      >
        <T>
          {Array.from({ length: count }, (_, index) => (
            <Skeleton
              key={index}
              className={cn(
                "w-full",
                variant === "charts"
                  ? "h-[26rem]"
                  : variant === "table"
                    ? "h-80"
                    : "h-32"
              )}
            />
          ))}
        </T>
      </div>
    </div>
  )
}
