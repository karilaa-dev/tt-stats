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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { DATABASE_ERROR_COPY } from "@/lib/db/errors"
import {
  configureDatabaseJobs,
  updateDatabaseDefinitions,
} from "@/lib/stats/functions"
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

function missingRuntimePrivileges(status: DatabaseSetupStatus): string[] {
  return [
    status.databaseRole.canCreateTemporaryTables
      ? null
      : "TEMPORARY on this database",
    status.databaseRole.canReadSourceTables
      ? null
      : "USAGE on public and SELECT on users, videos, and music",
    status.databaseRole.canUseCron ? null : "USAGE on the cron schema",
  ].filter((value): value is string => Boolean(value))
}

function missingSetupPrivileges(status: DatabaseSetupStatus): string[] {
  return [
    status.databaseRole.canCreate ? null : "CREATE on this database",
    ...missingRuntimePrivileges(status),
  ].filter((value): value is string => Boolean(value))
}

function hasLimitedSetupPrivileges(status: DatabaseSetupStatus): boolean {
  return (
    !status.databaseRole.superuser &&
    missingSetupPrivileges(status).length === 0
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
  const [setupPrivilegesConfirmed, setSetupPrivilegesConfirmed] =
    useState(false)
  const [confirming, setConfirming] = useState<"configure" | "update" | null>(
    null
  )
  const rollingError = validateCronSchedule(rollingSchedule)
  const dailyError = validateCronSchedule(dailySchedule)
  const installed = status ? configurationInstalled(status) : false
  const missingRolePrivileges = status
    ? installed
      ? missingRuntimePrivileges(status)
      : missingSetupPrivileges(status)
    : []
  const canConfigure = Boolean(
    status?.appConnection.ok &&
    status.scheduler.pgCronInstalled &&
    hasLimitedSetupPrivileges(status) &&
    setupPrivilegesConfirmed
  )
  const canUpdate = Boolean(
    status?.appConnection.ok &&
    status.scheduler.pgCronInstalled &&
    !status.databaseRole.superuser &&
    missingRuntimePrivileges(status).length === 0 &&
    setupPrivilegesConfirmed
  )

  const configureMutation = useMutation({
    mutationFn: () => {
      if (!setupPrivilegesConfirmed) {
        throw new Error(
          "Confirm that DB_URL has the listed non-superuser grants before running setup."
        )
      }
      return configureDatabaseJobs({
        data: {
          rollingSchedule: rollingSchedule.trim(),
          dailySchedule: dailySchedule.trim(),
          setupPrivilegesConfirmed: true,
        },
      })
    },
    onError: (error) => toast.error(safeActionError(error)),
    onSuccess: async (result) => {
      setConfirming(null)
      toast.success("TT Stats database jobs are configured.")
      for (const warning of result.warnings) toast.warning(warning)
      await queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!setupPrivilegesConfirmed) {
        throw new Error(
          "Confirm that DB_URL owns the installed TT Stats schema before updating it."
        )
      }
      return updateDatabaseDefinitions({
        data: { setupPrivilegesConfirmed: true },
      })
    },
    onError: (error) => toast.error(safeActionError(error)),
    onSuccess: async (result) => {
      setConfirming(null)
      toast.success("Database definitions updated; snapshot rebuilds queued.")
      for (const warning of result.warnings) toast.warning(warning)
      await queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  const actionPending = configureMutation.isPending || updateMutation.isPending

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
                state={
                  !status.snapshot.jobsApiInstalled
                    ? "waiting"
                    : status.snapshot.definitionsCurrent
                      ? "good"
                      : "bad"
                }
                title="Database definitions"
                description={
                  !status.snapshot.jobsApiInstalled
                    ? "Not checked until the snapshot API is installed."
                    : status.snapshot.definitionsCurrent
                      ? "The installed refresh procedures match this web app version."
                      : "An update is available. Existing schedules will be preserved."
                }
              />
              <DiagnosticRow
                state={
                  !status.appConnection.ok
                    ? "waiting"
                    : !status.databaseRole.superuser &&
                        missingRolePrivileges.length === 0
                      ? "good"
                      : "bad"
                }
                title="DB_URL limited grants"
                description={
                  !status.appConnection.ok
                    ? "Not checked until DB_URL connects successfully."
                    : status.databaseRole.superuser
                      ? "This DB_URL role is a superuser. Replace it with the limited role described below."
                      : missingRolePrivileges.length === 0
                        ? installed && !status.databaseRole.canCreate
                          ? "All runtime grants exist. Database CREATE is revoked and is needed only to reinstall a missing schema."
                          : "All required database-scoped grants exist. This role is not a superuser."
                        : `Missing: ${missingRolePrivileges.join(", ")}.`
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
                  !status.appConnection.ok
                    ? "waiting"
                    : status.scheduler.pgCronInstalled
                      ? "good"
                      : "bad"
                }
                title="PostgreSQL scheduler"
                description={
                  !status.appConnection.ok
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
              <>
                <Alert>
                  {status.ready ? <CheckCircle2Icon /> : <CircleDashedIcon />}
                  <AlertTitle>
                    {status.ready
                      ? "Database jobs are ready"
                      : status.snapshot.definitionsCurrent
                        ? "Configuration is ready; snapshots are pending"
                        : "Database definition update available"}
                  </AlertTitle>
                  <AlertDescription>
                    {status.ready
                      ? "Use the job cards below to edit schedules, pause or resume a job, inspect runs, or queue a refresh."
                      : status.snapshot.definitionsCurrent
                        ? "PostgreSQL will populate the dashboard asynchronously. This page checks progress every minute."
                        : "Update the procedures below to repair all-time charts and use completed half-hour buckets. Your cron schedules are not changed."}
                  </AlertDescription>
                </Alert>
                <Field
                  orientation="horizontal"
                  data-disabled={
                    controlsDisabled ||
                    actionPending ||
                    status.databaseRole.superuser ||
                    missingRuntimePrivileges(status).length > 0
                  }
                >
                  <FieldContent>
                    <FieldLabel htmlFor="update-database-definitions">
                      DB_URL owns the installed TT Stats schema
                    </FieldLabel>
                    <FieldDescription>
                      Confirm this to replace only TT Stats function and
                      procedure definitions, then queue both snapshot rebuilds.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="update-database-definitions"
                    checked={setupPrivilegesConfirmed}
                    disabled={
                      controlsDisabled ||
                      actionPending ||
                      status.databaseRole.superuser ||
                      missingRuntimePrivileges(status).length > 0
                    }
                    onCheckedChange={setSetupPrivilegesConfirmed}
                  />
                </Field>
                {!status.snapshot.definitionsCurrent ? (
                  <p className="text-sm text-destructive">
                    Update the database definitions before relying on the next
                    scheduled snapshots.
                  </p>
                ) : null}
                <div>
                  <Button
                    type="button"
                    variant={
                      status.snapshot.definitionsCurrent ? "outline" : "default"
                    }
                    disabled={controlsDisabled || !canUpdate || actionPending}
                    onClick={() => setConfirming("update")}
                  >
                    {updateMutation.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <WrenchIcon data-icon="inline-start" />
                    )}
                    Update database definitions
                  </Button>
                </div>
              </>
            ) : (
              <>
                {status.databaseRole.superuser ? (
                  <Alert variant="destructive">
                    <ShieldAlertIcon />
                    <AlertTitle>DB_URL is too privileged</AlertTitle>
                    <AlertDescription>
                      Setup is blocked for PostgreSQL superusers. Create the
                      limited login role shown below and update DB_URL before
                      continuing.
                    </AlertDescription>
                  </Alert>
                ) : !hasLimitedSetupPrivileges(status) ? (
                  <Alert>
                    <TriangleAlertIcon />
                    <AlertTitle>DB_URL needs limited grants</AlertTitle>
                    <AlertDescription>
                      Grant only the missing database privileges listed above.
                      Do not grant SUPERUSER, CREATEROLE, CREATEDB, REPLICATION,
                      or BYPASSRLS.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <FieldGroup>
                  <Field
                    orientation="horizontal"
                    data-disabled={
                      controlsDisabled ||
                      actionPending ||
                      !status.appConnection.ok ||
                      !status.scheduler.pgCronInstalled ||
                      !hasLimitedSetupPrivileges(status)
                    }
                  >
                    <FieldContent>
                      <FieldLabel htmlFor="setup-limited-privileges">
                        DB_URL has the listed non-superuser grants
                      </FieldLabel>
                      <FieldDescription>
                        Confirm that this connection may install the additive TT
                        Stats schema and own the two fixed jobs. It never
                        installs pg_cron or changes PostgreSQL configuration.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="setup-limited-privileges"
                      checked={setupPrivilegesConfirmed}
                      disabled={
                        controlsDisabled ||
                        actionPending ||
                        !status.appConnection.ok ||
                        !status.scheduler.pgCronInstalled ||
                        !hasLimitedSetupPrivileges(status)
                      }
                      onCheckedChange={setSetupPrivilegesConfirmed}
                    />
                  </Field>
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
                        disabled={controlsDisabled || actionPending}
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
                        disabled={controlsDisabled || actionPending}
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

                {!status.appConnection.ok ? (
                  <p className="text-sm text-destructive">
                    Setup is disabled until DB_URL connects successfully. Review
                    the diagnostics above.
                  </p>
                ) : status.databaseRole.superuser ? (
                  <p className="text-sm text-destructive">
                    Setup is disabled while DB_URL uses a PostgreSQL superuser.
                  </p>
                ) : !status.scheduler.pgCronInstalled ? (
                  <p className="text-sm text-destructive">
                    Setup is disabled until a PostgreSQL administrator enables
                    pg_cron.
                  </p>
                ) : !hasLimitedSetupPrivileges(status) ? (
                  <p className="text-sm text-destructive">
                    Setup is disabled until the missing limited grants are
                    applied.
                  </p>
                ) : !setupPrivilegesConfirmed ? (
                  <p className="text-sm text-muted-foreground">
                    Confirm the limited DB_URL grants to enable setup.
                  </p>
                ) : null}
                <div>
                  <Button
                    type="button"
                    disabled={
                      controlsDisabled ||
                      !canConfigure ||
                      Boolean(rollingError || dailyError) ||
                      actionPending
                    }
                    onClick={() => setConfirming("configure")}
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

      {status?.appConnection.ok && !status.scheduler.pgCronInstalled ? (
        <PgCronInstallationDialog />
      ) : null}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <DatabaseIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {confirming === "update"
                ? "Update TT Stats database definitions?"
                : "Configure TT Stats in PostgreSQL?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "update"
                ? "This replaces only TT Stats database definitions and queues rolling and daily rebuilds. Existing snapshots remain readable until each rebuild succeeds. Cron expressions, job states, extensions, and unrelated jobs are unchanged."
                : "This uses the non-superuser DB_URL role to apply the fixed additive snapshot schema, install only the two TT Stats schedules, grant the approved access, and queue both initial refreshes. It does not install extensions, change server configuration, delete existing snapshots, or touch unrelated cron jobs."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={actionPending}
              onClick={() =>
                confirming === "update"
                  ? updateMutation.mutate()
                  : configureMutation.mutate()
              }
            >
              {actionPending ? <Spinner data-icon="inline-start" /> : null}
              {actionPending
                ? confirming === "update"
                  ? "Updating…"
                  : "Configuring…"
                : confirming === "update"
                  ? "Update and rebuild"
                  : "Configure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function PgCronInstallationDialog() {
  const [open, setOpen] = useState(true)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>pg_cron installation required</AlertDialogTitle>
          <AlertDialogDescription>
            pg_cron is not installed or enabled in this database. A PostgreSQL
            administrator must install and enable it before database jobs can be
            configured.{" "}
            <a
              href="https://github.com/citusdata/pg_cron#setting-up-pg_cron"
              target="_blank"
              rel="noreferrer"
              aria-label="Open installation guide (opens in a new tab)"
              onClick={() => setOpen(false)}
            >
              Open installation guide
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
