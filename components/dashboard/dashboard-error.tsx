import { T } from "@/lib/i18n/provider"
import { useAdminAccess } from "./admin-access"
import { DatabaseZapIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
import { Button, buttonVariants } from "@/components/controls"
import { getSafeDatabaseError } from "@/lib/db/errors"
import { isRequestCancelled } from "@/lib/http-client"

export function DashboardError({
  error,
  reset,
}: {
  error?: unknown
  reset: () => void
}) {
  const { authenticated } = useAdminAccess()
  const presentation = isRequestCancelled(error)
    ? {
        title: "Loading cancelled",
        description: "You can try again when you are ready.",
        kind: "cancelled",
      }
    : authenticated
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
        <AlertTitle>
          <T>{presentation.title}</T>
        </AlertTitle>
        <AlertDescription>
          <T>{presentation.description}</T>
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <T>{"Try again"}</T>
        </Button>
        {showJobs && authenticated ? (
          <a
            href="/dashboard/jobs"
            className={buttonVariants({ variant: "outline" })}
          >
            <DatabaseZapIcon data-icon="inline-start" />
            <T>{"Open Database jobs"}</T>
          </a>
        ) : null}
      </div>
    </div>
  )
}
