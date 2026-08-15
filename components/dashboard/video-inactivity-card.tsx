import { useMutation } from "@tanstack/react-query"
import {
  BellRingIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  sendVideoNotificationTest,
  type VideoNotificationStatus,
} from "@/lib/notifications/functions"
import type { VideoMonitorDatabaseStatus } from "@/lib/notifications/status"

export function VideoInactivityCard({
  status,
  monitorDatabaseStatus,
  fakeMode = false,
}: {
  status: VideoNotificationStatus
  monitorDatabaseStatus: VideoMonitorDatabaseStatus
  fakeMode?: boolean
}) {
  const mutation = useMutation({
    mutationFn: () => sendVideoNotificationTest(),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    },
    onError: () => toast.error("The test notification could not be sent."),
  })

  const providerName = status.provider === "ntfy" ? "ntfy" : "webhook"

  return (
    <Card className="mb-6 min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Video inactivity notifications</CardTitle>
            <CardDescription className="mt-1">
              Alert after 5 minutes without a download, then escalate 5 minutes
              later if inactivity continues.
            </CardDescription>
          </div>
          <Badge variant={status.configured ? "default" : "secondary"}>
            {status.configured ? `Configured · ${providerName}` : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.configurationError ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Invalid notification configuration</AlertTitle>
            <AlertDescription>
              Configure exactly one valid HTTP(S) webhook or ntfy topic URL. An
              ntfy token can only be used with an ntfy URL.
            </AlertDescription>
          </Alert>
        ) : status.configured && fakeMode ? (
          <Alert>
            <BellRingIcon />
            <AlertTitle>Monitor paused in fake-data mode</AlertTitle>
            <AlertDescription>
              Automatic database checks are disabled, but the test button still
              sends through the configured destination.
            </AlertDescription>
          </Alert>
        ) : status.configured && monitorDatabaseStatus === "checking" ? (
          <Alert>
            <CircleDashedIcon />
            <AlertTitle>Checking monitor prerequisites</AlertTitle>
            <AlertDescription>
              Checking the database definitions and runtime grants. The test
              button is available while this finishes.
            </AlertDescription>
          </Alert>
        ) : status.configured && monitorDatabaseStatus === "unavailable" ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Monitor status unavailable</AlertTitle>
            <AlertDescription>
              Database diagnostics failed, so automatic monitor readiness could
              not be verified. The test button remains available.
            </AlertDescription>
          </Alert>
        ) : status.configured && monitorDatabaseStatus === "install" ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>Database setup required</AlertTitle>
            <AlertDescription>
              Use Install or repair database jobs above before the automatic
              monitor can run. The test button is available now.
            </AlertDescription>
          </Alert>
        ) : status.configured && monitorDatabaseStatus === "definitions" ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>Database update required</AlertTitle>
            <AlertDescription>
              Use Update database definitions above to install the persistent
              escalation state. The test button is available now.
            </AlertDescription>
          </Alert>
        ) : status.configured && monitorDatabaseStatus === "permissions" ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Monitor database grants required</AlertTitle>
            <AlertDescription>
              Reapply database/003_stats_snapshot_grants.sql for the runtime
              DB_URL role to grant video reads and monitor-state access. The
              test button remains available.
            </AlertDescription>
          </Alert>
        ) : status.configured ? (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Monitor active</AlertTitle>
            <AlertDescription>
              The server checks every minute, and each rolling refresh triggers
              an immediate check. A new download resets both alert stages.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <BellRingIcon />
            <AlertTitle>No destination configured</AlertTitle>
            <AlertDescription>
              Set VIDEO_INACTIVITY_WEBHOOK_URL, or set VIDEO_INACTIVITY_NTFY_URL
              with an optional ntfy token, then restart the app.
            </AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={!status.configured || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SendIcon data-icon="inline-start" />
          )}
          {mutation.isPending ? "Sending test…" : "Send test notification"}
        </Button>
      </CardContent>
    </Card>
  )
}
