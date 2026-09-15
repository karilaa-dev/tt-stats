import { T } from "@/lib/i18n/provider"
import { useMutation } from "@tanstack/react-query"
import {
  BellRingIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "@/components/controls/toast"

import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
import { Badge } from "@/components/controls"
import { Button } from "@/components/controls"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import { Spinner } from "@/components/controls"
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
            <CardTitle>
              <T>{"Video inactivity notifications"}</T>
            </CardTitle>
            <CardDescription className="mt-1">
              <T>
                {
                  "Alert after 5 minutes without a download, then escalate 5 minutes later if inactivity continues."
                }
              </T>
            </CardDescription>
          </div>
          <Badge variant={status.configured ? "default" : "secondary"}>
            <T>
              {status.configured ? `Configured · ${providerName}` : "Disabled"}
            </T>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <T>
          {status.configurationError ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>
                <T>{"Invalid notification configuration"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Configure exactly one valid HTTP(S) webhook or ntfy topic URL. An ntfy token can only be used with an ntfy URL."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured && fakeMode ? (
            <Alert>
              <BellRingIcon />
              <AlertTitle>
                <T>{"Monitor paused in fake-data mode"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Automatic database checks are disabled, but the test button still sends through the configured destination."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured && monitorDatabaseStatus === "checking" ? (
            <Alert>
              <CircleDashedIcon />
              <AlertTitle>
                <T>{"Checking monitor prerequisites"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Checking the database definitions and runtime grants. The test button is available while this finishes."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured && monitorDatabaseStatus === "unavailable" ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>
                <T>{"Monitor status unavailable"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Database diagnostics failed, so automatic monitor readiness could not be verified. The test button remains available."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured && monitorDatabaseStatus === "install" ? (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>
                <T>{"Database setup required"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Use Install or repair database jobs above before the automatic monitor can run. The test button is available now."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured && monitorDatabaseStatus === "definitions" ? (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>
                <T>{"Database update required"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Use Update database definitions above to install the persistent escalation state. The test button is available now."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured && monitorDatabaseStatus === "permissions" ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>
                <T>{"Monitor database grants required"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Reapply database/003_stats_snapshot_grants.sql for the runtime DB_URL role to grant video reads and monitor-state access. The test button remains available."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : status.configured ? (
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>
                <T>{"Monitor active"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "The server checks every minute, and each rolling refresh triggers an immediate check. A new download resets both alert stages."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <BellRingIcon />
              <AlertTitle>
                <T>{"No destination configured"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "Set VIDEO_INACTIVITY_WEBHOOK_URL, or set VIDEO_INACTIVITY_NTFY_URL with an optional ntfy token, then restart the app."
                  }
                </T>
              </AlertDescription>
            </Alert>
          )}
        </T>

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={!status.configured || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <T>
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
          </T>
          <T>
            {mutation.isPending ? "Sending test…" : "Send test notification"}
          </T>
        </Button>
      </CardContent>
    </Card>
  )
}
