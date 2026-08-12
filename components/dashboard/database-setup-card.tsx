import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  DatabaseIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { DATABASE_ERROR_COPY } from "@/lib/db/errors"
import { configureDatabaseJobs } from "@/lib/stats/functions"
import { statsQueryKey } from "@/lib/stats/query-options"
import {
  RECOMMENDED_STATS_SCHEDULE,
  validateCronSchedule,
} from "@/lib/stats/schedule"
import type { DatabaseSetupStatus } from "@/lib/stats/setup-types"

type DiagnosticState = "good" | "bad" | "waiting"

function errorDescription(
  kind: DatabaseSetupStatus["appConnection"]["errorKind"]
): string {
  return kind
    ? DATABASE_ERROR_COPY[kind].description
    : "PostgreSQL did not return diagnostic information."
}

function safeActionError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Database setup failed safely. Existing snapshots were left in place."
}

function configurationInstalled(status: DatabaseSetupStatus): boolean {
  return (
    status.snapshot.schemaInstalled &&
    status.snapshot.tablesInstalled &&
    status.snapshot.jobsApiInstalled &&
    status.snapshot.appCanRead &&
    status.snapshot.appCanManageJobs &&
    status.scheduler.pgCronInstalled &&
    status.scheduler.rollingJobInstalled &&
    status.scheduler.dailyJobInstalled
  )
}

export function DatabaseSetupCard({
  status,
  checking = false,
  controlsDisabled = false,
}: {
  status?: DatabaseSetupStatus
  checking?: boolean
  controlsDisabled?: boolean
}) {
  const queryClient = useQueryClient()
  const [rollingSchedule, setRollingSchedule] = useState<string>(
    RECOMMENDED_STATS_SCHEDULE.rolling_24h
  )
  const [dailySchedule, setDailySchedule] = useState<string>(
    RECOMMENDED_STATS_SCHEDULE.daily
  )
  const [confirming, setConfirming] = useState(false)
  const rollingError = validateCronSchedule(rollingSchedule)
  const dailyError = validateCronSchedule(dailySchedule)
  const installed = status ? configurationInstalled(status) : false
  const canConfigure = Boolean(
    status?.appConnection.ok &&
    status.installerConnection.ok &&
    status.installerConnection.sameDatabase
  )

  const configureMutation = useMutation({
    mutationFn: () =>
      configureDatabaseJobs({
        data: {
          rollingSchedule: rollingSchedule.trim(),
          dailySchedule: dailySchedule.trim(),
        },
      }),
    onError: (error) => toast.error(safeActionError(error)),
    onSuccess: async (result) => {
      setConfirming(false)
      toast.success("TT Stats database jobs are configured.")
      for (const warning of result.warnings) toast.warning(warning)
      await queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  return (
    <Card className="mb-6 min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Setup & diagnostics</CardTitle>
            <CardDescription className="mt-1">
              Verify the app connection, snapshot schema, permissions, pg_cron,
              and fixed schedules independently.
            </CardDescription>
          </div>
          <Badge variant={status?.ready ? "default" : "secondary"}>
            {checking && !status
              ? "Checking"
              : status?.ready
                ? "Ready"
                : "Action needed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {checking && !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Checking PostgreSQL without running aggregations…
          </div>
        ) : status ? (
          <>
            {status.appConnection.ok && !status.snapshot.schemaInstalled ? (
              <Alert>
                <DatabaseIcon />
                <AlertTitle>Database connection verified</AlertTitle>
                <AlertDescription>
                  DB_URL works. The dashboard is unavailable because the TT
                  Stats snapshot objects have not been installed in this
                  database yet.
                </AlertDescription>
              </Alert>
            ) : null}

            {!status.scheduler.pgCronInstalled &&
            status.installerConnection.ok ? (
              <Alert variant="destructive">
                <ShieldAlertIcon />
                <AlertTitle>pg_cron is not enabled</AlertTitle>
                <AlertDescription>
                  The setup action can enable the extension when the installer
                  role is allowed. The PostgreSQL host must already provide
                  pg_cron through shared_preload_libraries and target this
                  database with cron.database_name.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              <DiagnosticRow
                state={status.appConnection.ok ? "good" : "bad"}
                title="Application connection"
                description={
                  status.appConnection.ok
                    ? "DB_URL connected successfully."
                    : errorDescription(status.appConnection.errorKind)
                }
              />
              <DiagnosticRow
                state={status.installerConnection.ok ? "good" : "bad"}
                title="Setup connection"
                description={
                  status.installerConnection.ok
                    ? status.installerConnection.configured
                      ? "DB_ADMIN_URL connected; credentials stay server-side."
                      : "Using DB_URL. Add DB_ADMIN_URL only if this role cannot install or grant objects."
                    : errorDescription(status.installerConnection.errorKind)
                }
              />
              <DiagnosticRow
                state={
                  !status.appConnection.ok
                    ? "waiting"
                    : status.snapshot.schemaInstalled &&
                        status.snapshot.tablesInstalled &&
                        status.snapshot.jobsApiInstalled
                      ? "good"
                      : "bad"
                }
                title="Snapshot schema & API"
                description={
                  !status.appConnection.ok
                    ? "Not checked until the application connection succeeds."
                    : status.snapshot.schemaInstalled &&
                        status.snapshot.tablesInstalled &&
                        status.snapshot.jobsApiInstalled
                      ? "All TT Stats snapshot tables and approved functions exist."
                      : "One or more TT Stats database objects are missing."
                }
              />
              <DiagnosticRow
                state={
                  !status.snapshot.schemaInstalled
                    ? "waiting"
                    : status.snapshot.appCanRead &&
                        status.snapshot.appCanManageJobs
                      ? "good"
                      : "bad"
                }
                title="Application permissions"
                description={
                  !status.snapshot.schemaInstalled
                    ? "Not checked until the snapshot schema is installed."
                    : status.snapshot.appCanRead &&
                        status.snapshot.appCanManageJobs
                      ? "The app can read snapshots and call only the fixed management API."
                      : "Snapshot reads or approved job-management grants are incomplete."
                }
              />
              <DiagnosticRow
                state={
                  !status.appConnection.ok && !status.installerConnection.ok
                    ? "waiting"
                    : status.scheduler.pgCronInstalled
                      ? "good"
                      : "bad"
                }
                title="PostgreSQL scheduler"
                description={
                  !status.appConnection.ok && !status.installerConnection.ok
                    ? "Not checked until a server-side connection succeeds."
                    : status.scheduler.pgCronInstalled
                      ? `pg_cron ${status.scheduler.pgCronVersion ?? "(version unavailable)"} is enabled.`
                      : "The pg_cron extension is not enabled in this database."
                }
              />
              <DiagnosticRow
                state={
                  !status.scheduler.pgCronInstalled
                    ? "waiting"
                    : status.scheduler.rollingJobInstalled &&
                        status.scheduler.dailyJobInstalled
                      ? "good"
                      : "bad"
                }
                title="Fixed schedules"
                description={
                  !status.scheduler.pgCronInstalled
                    ? "Not checked until pg_cron is enabled."
                    : status.scheduler.rollingJobInstalled &&
                        status.scheduler.dailyJobInstalled
                      ? "Both TT Stats jobs are installed."
                      : "The rolling or daily fixed job is missing."
                }
              />
              <DiagnosticRow
                state={
                  !status.scheduler.rollingJobInstalled ||
                  !status.scheduler.dailyJobInstalled
                    ? "waiting"
                    : status.snapshot.rollingSeeded &&
                        status.snapshot.dailySeeded
                      ? "good"
                      : "waiting"
                }
                title="Initial snapshots"
                description={
                  !status.scheduler.rollingJobInstalled ||
                  !status.scheduler.dailyJobInstalled
                    ? "Not checked until both fixed schedules are installed."
                    : status.snapshot.rollingSeeded &&
                        status.snapshot.dailySeeded
                      ? "Rolling and daily datasets have completed at least once."
                      : "Waiting for one or both initial refresh requests to complete."
                }
              />
            </div>

            {installed ? (
              <Alert>
                {status.ready ? <CheckCircle2Icon /> : <CircleDashedIcon />}
                <AlertTitle>
                  {status.ready
                    ? "Database jobs are ready"
                    : "Configuration is ready; snapshots are pending"}
                </AlertTitle>
                <AlertDescription>
                  {status.ready
                    ? "Use the job cards below to edit schedules, pause or resume a job, inspect runs, or queue a refresh."
                    : "PostgreSQL will populate the dashboard asynchronously. This page checks progress every minute."}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {!status.installerConnection.configured &&
                (!status.installerConnection.canCreate ||
                  !status.installerConnection.superuser) ? (
                  <Alert>
                    <TriangleAlertIcon />
                    <AlertTitle>
                      An installer connection may be required
                    </AlertTitle>
                    <AlertDescription>
                      If setup is rejected, set the server-only DB_ADMIN_URL to
                      a database-owner connection, restart the app, and retry.
                      The normal DB_URL remains the runtime connection.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <FieldGroup>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field data-invalid={Boolean(rollingError)}>
                      <FieldLabel htmlFor="setup-rolling-schedule">
                        Rolling 24-hour schedule
                      </FieldLabel>
                      <Input
                        id="setup-rolling-schedule"
                        value={rollingSchedule}
                        maxLength={101}
                        spellCheck={false}
                        aria-invalid={Boolean(rollingError)}
                        disabled={
                          controlsDisabled || configureMutation.isPending
                        }
                        onChange={(event) =>
                          setRollingSchedule(event.target.value)
                        }
                      />
                      <FieldDescription>
                        Recommended: every five minutes.
                      </FieldDescription>
                      {rollingError ? (
                        <FieldError>{rollingError}</FieldError>
                      ) : null}
                    </Field>
                    <Field data-invalid={Boolean(dailyError)}>
                      <FieldLabel htmlFor="setup-daily-schedule">
                        Daily snapshot schedule
                      </FieldLabel>
                      <Input
                        id="setup-daily-schedule"
                        value={dailySchedule}
                        maxLength={101}
                        spellCheck={false}
                        aria-invalid={Boolean(dailyError)}
                        disabled={
                          controlsDisabled || configureMutation.isPending
                        }
                        onChange={(event) =>
                          setDailySchedule(event.target.value)
                        }
                      />
                      <FieldDescription>
                        Recommended: 00:07 UTC each day.
                      </FieldDescription>
                      {dailyError ? (
                        <FieldError>{dailyError}</FieldError>
                      ) : null}
                    </Field>
                  </div>
                </FieldGroup>

                {!canConfigure ? (
                  <p className="text-sm text-destructive">
                    Setup is disabled until both server-side connections reach
                    the same database. Review the diagnostics above.
                  </p>
                ) : null}
                <div>
                  <Button
                    type="button"
                    disabled={
                      controlsDisabled ||
                      !canConfigure ||
                      Boolean(rollingError || dailyError) ||
                      configureMutation.isPending
                    }
                    onClick={() => setConfirming(true)}
                  >
                    {configureMutation.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <WrenchIcon data-icon="inline-start" />
                    )}
                    Install or repair database jobs
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Diagnostics could not be loaded</AlertTitle>
            <AlertDescription>
              Retry this page. No database configuration was changed.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <DatabaseIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Configure TT Stats in PostgreSQL?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This applies the fixed additive snapshot schema, enables pg_cron,
              installs only the two TT Stats schedules, grants the runtime role
              the approved access, and queues both initial refreshes. Existing
              snapshots and unrelated cron jobs are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={configureMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={configureMutation.isPending}
              onClick={() => configureMutation.mutate()}
            >
              {configureMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {configureMutation.isPending ? "Configuring…" : "Configure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function DiagnosticRow({
  state,
  title,
  description,
}: {
  state: DiagnosticState
  title: string
  description: string
}) {
  const Icon =
    state === "good"
      ? CheckCircle2Icon
      : state === "bad"
        ? TriangleAlertIcon
        : CircleDashedIcon

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border p-3">
      <Icon
        className={
          state === "good"
            ? "mt-0.5 size-4 shrink-0 text-emerald-500"
            : state === "bad"
              ? "mt-0.5 size-4 shrink-0 text-destructive"
              : "mt-0.5 size-4 shrink-0 text-muted-foreground"
        }
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
