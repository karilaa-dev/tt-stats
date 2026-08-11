import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function DashboardLoading({
  variant = "cards",
}: {
  variant?: "cards" | "charts" | "table"
}) {
  const count = variant === "charts" ? 3 : variant === "table" ? 1 : 4

  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Loading dashboard data"
    >
      <Alert>
        <Spinner />
        <AlertTitle>Loading the latest statistics</AlertTitle>
        <AlertDescription>
          Navigation and filters remain available while data refreshes in the
          background.
        </AlertDescription>
      </Alert>
      <div
        className={cn(
          "grid gap-4",
          variant === "charts"
            ? "xl:grid-cols-2"
            : variant === "cards"
              ? "sm:grid-cols-2 xl:grid-cols-4"
              : undefined
        )}
      >
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
      </div>
    </div>
  )
}
