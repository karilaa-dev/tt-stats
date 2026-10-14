import { T } from "@/lib/i18n/provider"
import { useAdminAccess } from "./admin-access"
import { DatabaseZapIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
import { Button, buttonVariants } from "@/components/controls"
import { getSafeDatabaseError } from "@/lib/db/errors"
import { isRequestCancelled } from "@/lib/http-client"

export function DashboardError({
  error,
  reset,
  title = "Statistics are unavailable",
  description = "Please try again in a moment.",
  adminHint,
}: {
  error?: unknown
  reset: () => void
  /** Shown to visitors, who never see database details. */
  title?: string
  description?: string
  /** Extra guidance for administrators, such as a setup step. */
  adminHint?: string
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
      : { title, description, kind: "unavailable" }
  const showOperations =
    authenticated &&
    (Boolean(adminHint) ||
      [
        "snapshotSchema",
        "snapshotsMissing",
        "permission",
        "unavailable",
      ].includes(presentation.kind))

  return (
    <Alert
      variant={presentation.kind === "cancelled" ? "default" : "destructive"}
      className="dashboard-error"
    >
      <TriangleAlertIcon />
      <AlertTitle>
        <T>{presentation.title}</T>
      </AlertTitle>
      <AlertDescription>
        <p>
          <T>{presentation.description}</T>
        </p>
        {authenticated && adminHint && presentation.kind !== "cancelled" ? (
          <p>
            <T>{adminHint}</T>
          </p>
        ) : null}
        <div className="dashboard-error-actions">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCwIcon data-icon="inline-start" />
            <T>{"Try again"}</T>
          </Button>
          {showOperations ? (
            <a
              href="/dashboard/jobs"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <DatabaseZapIcon data-icon="inline-start" />
              <T>{"Open Operations"}</T>
            </a>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  )
}
