import { useTranslation } from "@/lib/i18n/provider"
import { Skeleton } from "@/components/controls"
import { cn } from "@/lib/utils"

/** Layout-shaped placeholders; the page heading and filters stay usable. */
export function DashboardLoading({
  variant = "cards",
  count,
}: {
  variant?: "cards" | "charts" | "table" | "summary-table"
  count?: number
}) {
  const { t } = useTranslation()

  return (
    <div
      className="dashboard-loading"
      role="status"
      aria-busy="true"
      aria-label={t("Loading the latest statistics")}
    >
      {variant === "summary-table" ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : null}
      {variant === "table" || variant === "summary-table" ? (
        <div className="dashboard-loading-table">
          <Skeleton className="h-7 w-48" />
          {Array.from({ length: count ?? 8 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            variant === "charts"
              ? "xl:grid-cols-2"
              : "sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {Array.from(
            { length: count ?? (variant === "charts" ? 4 : 6) },
            (_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  "w-full rounded-xl",
                  variant === "charts" ? "h-[26rem]" : "h-36"
                )}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
