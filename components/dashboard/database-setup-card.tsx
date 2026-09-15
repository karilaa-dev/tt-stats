import { T, useTranslation } from "@/lib/i18n/provider"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  DatabaseIcon,
  TriangleAlertIcon,
  WrenchIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { toast } from "@/components/controls/toast"

import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
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
} from "@/components/controls"
import { Badge } from "@/components/controls"
import { Button } from "@/components/controls"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/controls"
import { Input } from "@/components/controls"
import { Spinner } from "@/components/controls"
import { Switch } from "@/components/controls"
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
      : "USAGE on public and SELECT on users, videos, music, and video_details",
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
  return missingSetupPrivileges(status).length === 0
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
  const { t } = useTranslation()

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
    missingRuntimePrivileges(status).length === 0 &&
    setupPrivilegesConfirmed
  )

  const configureMutation = useMutation({
    mutationFn: () => {
      if (!setupPrivilegesConfirmed) {
        throw new Error(
          "Confirm that DB_URL has the listed administrative privileges before running setup."
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
      toast.success("@ttgrab Stats database jobs are configured.")
      for (const warning of result.warnings) toast.warning(warning)
      await queryClient.invalidateQueries({ queryKey: statsQueryKey })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!setupPrivilegesConfirmed) {
        throw new Error(
          "Confirm that DB_URL can update the installed statistics schema before updating it."
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
            <CardTitle>
              <T>{"Setup & diagnostics"}</T>
            </CardTitle>
            <CardDescription className="mt-1">
              <T>
                {
                  "Verify the app connection, snapshot schema, permissions, pg_cron, and fixed schedules independently."
                }
              </T>
            </CardDescription>
          </div>
          <Badge variant={status?.ready ? "default" : "secondary"}>
            <T>
              {checking && !status
                ? "Checking"
                : status?.ready
                  ? "Ready"
                  : "Action needed"}
            </T>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {checking && !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <T>{" Checking PostgreSQL without running aggregations…"}</T>
          </div>
        ) : status ? (
          <>
            <T>
              {status.appConnection.ok && !status.snapshot.schemaInstalled ? (
                <Alert>
                  <DatabaseIcon />
                  <AlertTitle>
                    <T>{"Database connection verified"}</T>
                  </AlertTitle>
                  <AlertDescription>
                    <T>
                      {
                        "DB_URL works. The dashboard is unavailable because the TT Stats snapshot objects have not been installed in this database yet."
                      }
                    </T>
                  </AlertDescription>
                </Alert>
              ) : null}
            </T>

            <div className="grid gap-3 lg:grid-cols-2">
              <DiagnosticRow
                state={status.appConnection.ok ? "good" : "bad"}
                title={t("Application connection")}
                description={t(
                  status.appConnection.ok
                    ? "DB_URL connected successfully."
                    : errorDescription(status.appConnection.errorKind)
                )}
              />
              <DiagnosticRow
                state={
                  !status.snapshot.jobsApiInstalled
                    ? "waiting"
                    : status.snapshot.definitionsCurrent
                      ? "good"
                      : "bad"
                }
                title={t("Database definitions")}
                description={t(
                  !status.snapshot.jobsApiInstalled
                    ? "Not checked until the snapshot API is installed."
                    : status.snapshot.definitionsCurrent
                      ? "The installed refresh procedures match this web app version."
                      : "An update is available. Existing schedules will be preserved."
                )}
              />
              <DiagnosticRow
                state={status.website?.ready ? "good" : "bad"}
                title={t("Website storage")}
                description={t(
                  status.website?.ready
                    ? "User, session and query-cache tables are ready."
                    : "Website tables are missing or incompatible. Check startup logs."
                )}
              />
              <DiagnosticRow
                state={
                  !status.appConnection.ok
                    ? "waiting"
                    : missingRolePrivileges.length === 0
                      ? "good"
                      : "bad"
                }
                title={t("DB_URL privileges")}
                description={t(
                  !status.appConnection.ok
                    ? "Not checked until DB_URL connects successfully."
                    : missingRolePrivileges.length === 0
                      ? installed && !status.databaseRole.canCreate
                        ? "All runtime grants exist. Database CREATE is revoked and is needed only to reinstall a missing schema."
                        : "All required database privileges are available."
                      : `Missing: ${missingRolePrivileges.join(", ")}.`
                )}
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
                title={t("Snapshot schema & API")}
                description={t(
                  !status.appConnection.ok
                    ? "Not checked until the application connection succeeds."
                    : status.snapshot.schemaInstalled &&
                        status.snapshot.tablesInstalled &&
                        status.snapshot.jobsApiInstalled
                      ? "All @ttgrab Stats snapshot tables and approved functions exist."
                      : "One or more @ttgrab Stats database objects are missing."
                )}
              />
              <DiagnosticRow
                state={
                  !status.snapshot.schemaInstalled
                    ? "waiting"
                    : status.snapshot.appCanRead &&
                        status.snapshot.appCanManageJobs &&
                        status.snapshot.appCanMonitorDownloads
                      ? "good"
                      : "bad"
                }
                title={t("Application permissions")}
                description={t(
                  !status.snapshot.schemaInstalled
                    ? "Not checked until the snapshot schema is installed."
                    : status.snapshot.appCanRead &&
                        status.snapshot.appCanManageJobs &&
                        status.snapshot.appCanMonitorDownloads
                      ? "The app can read snapshots and video downloads, call only the fixed management API, and update the video-monitor state."
                      : "Snapshot reads, approved job-management grants, or video-monitor state grants are incomplete."
                )}
              />
              <DiagnosticRow
                state={
                  !status.appConnection.ok
                    ? "waiting"
                    : status.scheduler.pgCronInstalled
                      ? "good"
                      : "bad"
                }
                title={t("PostgreSQL scheduler")}
                description={t(
                  !status.appConnection.ok
                    ? "Not checked until a server-side connection succeeds."
                    : status.scheduler.pgCronInstalled
                      ? `pg_cron ${status.scheduler.pgCronVersion ?? "(version unavailable)"} is enabled.`
                      : "The pg_cron extension is not enabled in this database."
                )}
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
                title={t("Fixed schedules")}
                description={t(
                  !status.scheduler.pgCronInstalled
                    ? "Not checked until pg_cron is enabled."
                    : status.scheduler.rollingJobInstalled &&
                        status.scheduler.dailyJobInstalled
                      ? "Both @ttgrab Stats jobs are installed."
                      : "The rolling or daily fixed job is missing."
                )}
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
                title={t("Initial snapshots")}
                description={t(
                  !status.scheduler.rollingJobInstalled ||
                    !status.scheduler.dailyJobInstalled
                    ? "Not checked until both fixed schedules are installed."
                    : status.snapshot.rollingSeeded &&
                        status.snapshot.dailySeeded
                      ? "Rolling and daily datasets have completed at least once."
                      : "Waiting for one or both initial refresh requests to complete."
                )}
              />
            </div>

            {installed ? (
              <>
                <Alert>
                  <T>
                    {status.ready ? <CheckCircle2Icon /> : <CircleDashedIcon />}
                  </T>
                  <AlertTitle>
                    <T>
                      {status.ready
                        ? "Database jobs are ready"
                        : status.snapshot.definitionsCurrent
                          ? "Configuration is ready; snapshots are pending"
                          : "Database definition update available"}
                    </T>
                  </AlertTitle>
                  <AlertDescription>
                    <T>
                      {status.ready
                        ? "Use the job cards below to edit schedules, pause or resume a job, inspect runs, or queue a refresh."
                        : status.snapshot.definitionsCurrent
                          ? "PostgreSQL will populate the dashboard asynchronously. This page checks progress every minute."
                          : "Update the procedures below to repair all-time charts and use completed half-hour buckets. Your cron schedules are not changed."}
                    </T>
                  </AlertDescription>
                </Alert>
                <Field
                  orientation="horizontal"
                  data-disabled={
                    controlsDisabled ||
                    actionPending ||
                    missingRuntimePrivileges(status).length > 0
                  }
                >
                  <FieldContent>
                    <FieldLabel htmlFor="update-database-definitions">
                      <T>
                        {"DB_URL can update the installed statistics schema"}
                      </T>
                    </FieldLabel>
                    <FieldDescription>
                      <T>
                        {
                          "Confirm this to replace only @ttgrab Stats function and procedure definitions, then queue both snapshot rebuilds."
                        }
                      </T>
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="update-database-definitions"
                    checked={setupPrivilegesConfirmed}
                    disabled={
                      controlsDisabled ||
                      actionPending ||
                      missingRuntimePrivileges(status).length > 0
                    }
                    onCheckedChange={setSetupPrivilegesConfirmed}
                  />
                </Field>
                <T>
                  {!status.snapshot.definitionsCurrent ? (
                    <p className="text-sm text-destructive">
                      <T>
                        {
                          "Update the database definitions before relying on the next scheduled snapshots."
                        }
                      </T>
                    </p>
                  ) : null}
                </T>
                <div>
                  <Button
                    type="button"
                    variant={
                      status.snapshot.definitionsCurrent ? "outline" : "default"
                    }
                    disabled={controlsDisabled || !canUpdate || actionPending}
                    onClick={() => setConfirming("update")}
                  >
                    <T>
                      {updateMutation.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <WrenchIcon data-icon="inline-start" />
                      )}
                    </T>
                    <T>{"Update database definitions"}</T>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <T>
                  {!hasLimitedSetupPrivileges(status) ? (
                    <Alert>
                      <TriangleAlertIcon />
                      <AlertTitle>
                        <T>{"DB_URL needs additional privileges"}</T>
                      </AlertTitle>
                      <AlertDescription>
                        <T>
                          {
                            "Grant only the missing database privileges listed above. Use the administrative connection configured in DB_URL."
                          }
                        </T>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </T>

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
                        <T>
                          {"DB_URL has the listed administrative privileges"}
                        </T>
                      </FieldLabel>
                      <FieldDescription>
                        <T>
                          {
                            "Confirm that this connection may install the additive TT Stats schema and own the two fixed jobs. It never installs pg_cron or changes PostgreSQL configuration."
                          }
                        </T>
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
                        <T>{"Rolling 24-hour schedule"}</T>
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
                        <T>{"Recommended: every five minutes."}</T>
                      </FieldDescription>
                      <T>
                        {rollingError ? (
                          <FieldError>
                            <T>{rollingError}</T>
                          </FieldError>
                        ) : null}
                      </T>
                    </Field>
                    <Field data-invalid={Boolean(dailyError)}>
                      <FieldLabel htmlFor="setup-daily-schedule">
                        <T>{"Daily snapshot schedule"}</T>
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
                        <T>{"Recommended: 00:07 UTC each day."}</T>
                      </FieldDescription>
                      <T>
                        {dailyError ? (
                          <FieldError>
                            <T>{dailyError}</T>
                          </FieldError>
                        ) : null}
                      </T>
                    </Field>
                  </div>
                </FieldGroup>

                <T>
                  {!status.appConnection.ok ? (
                    <p className="text-sm text-destructive">
                      <T>
                        {
                          "Setup is disabled until DB_URL connects successfully. Review the diagnostics above."
                        }
                      </T>
                    </p>
                  ) : !status.scheduler.pgCronInstalled ? (
                    <p className="text-sm text-destructive">
                      <T>
                        {
                          "Setup is disabled until a PostgreSQL administrator enables pg_cron."
                        }
                      </T>
                    </p>
                  ) : !hasLimitedSetupPrivileges(status) ? (
                    <p className="text-sm text-destructive">
                      <T>
                        {
                          "Setup is disabled until the missing required privileges are applied."
                        }
                      </T>
                    </p>
                  ) : !setupPrivilegesConfirmed ? (
                    <p className="text-sm text-muted-foreground">
                      <T>
                        {"Confirm the limited DB_URL grants to enable setup."}
                      </T>
                    </p>
                  ) : null}
                </T>
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
                    <T>
                      {configureMutation.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <WrenchIcon data-icon="inline-start" />
                      )}
                    </T>
                    <T>{"Install or repair database jobs"}</T>
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              <T>{"Diagnostics could not be loaded"}</T>
            </AlertTitle>
            <AlertDescription>
              <T>{"Retry this page. No database configuration was changed."}</T>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <T>
        {status?.appConnection.ok && !status.scheduler.pgCronInstalled ? (
          <PgCronInstallationDialog />
        ) : null}
      </T>

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
              <T>
                {confirming === "update"
                  ? "Update @ttgrab Stats database definitions?"
                  : "Configure @ttgrab Stats in PostgreSQL?"}
              </T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T>
                {confirming === "update"
                  ? "This replaces only @ttgrab Stats database definitions and queues rolling and daily rebuilds. Existing snapshots remain readable until each rebuild succeeds. Cron expressions, job states, extensions, and unrelated jobs are unchanged."
                  : "This uses the administrative DB_URL connection to apply the fixed additive snapshot schema, install only the two @ttgrab Stats schedules, grant the approved access, and queue both initial refreshes. It does not install extensions, change server configuration, delete existing snapshots, or touch unrelated cron jobs."}
              </T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>
              <T>{"Cancel"}</T>
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
              <T>
                {actionPending ? <Spinner data-icon="inline-start" /> : null}
              </T>
              <T>
                {actionPending
                  ? confirming === "update"
                    ? "Updating…"
                    : "Configuring…"
                  : confirming === "update"
                    ? "Update and rebuild"
                    : "Configure"}
              </T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function PgCronInstallationDialog() {
  const { t } = useTranslation()

  const [open, setOpen] = useState(true)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            <T>{"pg_cron installation required"}</T>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T>
              {
                "pg_cron is not installed or enabled in this database. A PostgreSQL administrator must install and enable it before database jobs can be configured."
              }
            </T>{" "}
            <a
              href="https://github.com/citusdata/pg_cron#setting-up-pg_cron"
              target="_blank"
              rel="noreferrer"
              aria-label={t("Open installation guide (opens in a new tab)")}
              onClick={() => setOpen(false)}
            >
              <T>{"Open installation guide"}</T>
              <span className="sr-only">
                <T>{" (opens in a new tab)"}</T>
              </span>
            </a>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <T>{"Close"}</T>
          </AlertDialogCancel>
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
        <p className="font-medium">
          <T>{title}</T>
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <T>{description}</T>
        </p>
      </div>
    </div>
  )
}
