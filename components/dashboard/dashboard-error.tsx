import { useAdminAccess } from "./admin-access"
import { DatabaseZapIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { getSafeDatabaseError } from "@/lib/db/errors"

export function DashboardError({
  error,
  reset,
}: {
  error?: unknown
  reset: () => void
}) {
  const { authenticated } = useAdminAccess()
  const presentation = authenticated
    ? getSafeDatabaseError(error)
    : {
        title: "Statistics are unavailable",
        description: "Please try again in a moment.",
        kind: "unavailable",
      }
  const showJobs = [
    "snapshotSchema",
    "snapshotsMissing",
    "permission",
    "unavailable",
  ].includes(presentation.kind)

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>{presentation.title}</AlertTitle>
        <AlertDescription>{presentation.description}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        {showJobs && authenticated ? (
          <a
            href="/dashboard/jobs"
            className={buttonVariants({ variant: "outline" })}
          >
            <DatabaseZapIcon data-icon="inline-start" />
            Open Database jobs
          </a>
        ) : null}
      </div>
    </div>
  )
}
