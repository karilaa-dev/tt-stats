import { TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function DashboardError({
  reset,
}: {
  error?: unknown
  reset: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Statistics are unavailable</AlertTitle>
        <AlertDescription>
          The dashboard could not load its data. No database or configuration
          details were exposed.
        </AlertDescription>
      </Alert>
      <Button className="self-start" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
