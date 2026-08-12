import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  DatabaseIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
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
  const [confirming, setConfirming] = useState(false)
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

            {!status.scheduler.pgCronInstalled && status.appConnection.ok ? (
              <Alert variant="destructive">
                <ShieldAlertIcon />
                <AlertTitle>pg_cron is not enabled</AlertTitle>
                <AlertDescription>
                  The app deliberately cannot enable this extension. Complete
                  the one-time administrator steps below, then retry the
                  diagnostics. DB_URL does not need to be a superuser.
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
                          ? "All runtime grants exist. Database CREATE is revoked and is needed only for a later repair."
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

            <PostgresAdministratorGuide />

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
                      configureMutation.isPending ||
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
                        configureMutation.isPending ||
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
                    pg_cron using the guide above.
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
              This uses the non-superuser DB_URL role to apply the fixed
              additive snapshot schema, install only the two TT Stats schedules,
              grant the approved access, and queue both initial refreshes. It
              does not install extensions, change server configuration, delete
              existing snapshots, or touch unrelated cron jobs.
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

function PostgresAdministratorGuide() {
  return (
    <Alert>
      <ShieldCheckIcon />
      <AlertTitle>One-time administrator guide for PostgreSQL 17</AlertTitle>
      <AlertDescription className="flex min-w-0 flex-col gap-3">
        <p>
          The <code>DB_URL</code> role does not need <code>SUPERUSER</code>,{" "}
          <code>CREATEROLE</code>, <code>CREATEDB</code>,{" "}
          <code>REPLICATION</code>, or <code>BYPASSRLS</code>. An administrator
          only needs to prepare pg_cron and grant access to this one database.
        </p>
        <ol className="ml-4 flex list-decimal flex-col gap-3">
          <li>
            <p className="font-medium text-foreground">
              Install and preload pg_cron on the PostgreSQL host
            </p>
            <p>
              Install the PostgreSQL 17 package, edit the cluster configuration,
              and restart PostgreSQL. If <code>shared_preload_libraries</code>{" "}
              already contains real libraries, preserve them and append{" "}
              <code>pg_cron</code>. Never paste placeholder names such as{" "}
              <code>existing_library</code>.
            </p>
            <SetupCode>{`sudo apt install postgresql-17-cron
sudoedit /etc/postgresql/17/main/postgresql.conf
sudo systemctl restart postgresql@17-main`}</SetupCode>
            <SetupCode>{`shared_preload_libraries = 'pg_cron'
cron.database_name = '<database>'
cron.timezone = 'UTC'`}</SetupCode>
          </li>
          <li>
            <p className="font-medium text-foreground">
              Run the one-time SQL as a PostgreSQL administrator
            </p>
            <p>
              Replace every angle-bracket placeholder with the real database,
              DB_URL role, and password values; do not paste placeholders
              literally. Of these statements, only{" "}
              <code>CREATE EXTENSION pg_cron</code> normally requires a
              PostgreSQL superuser. <code>CREATE ROLE</code> requires{" "}
              <code>CREATEROLE</code>; database and table owners can issue the
              corresponding grants.
            </p>
            <SetupCode>{`-- Only if the DB_URL role does not exist yet:
CREATE ROLE "<tt_stats_role>" LOGIN NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD '<strong-generated-password>';

CREATE EXTENSION IF NOT EXISTS pg_cron;

GRANT CONNECT, CREATE, TEMPORARY
ON DATABASE "<database>" TO "<tt_stats_role>";

GRANT USAGE ON SCHEMA public, cron TO "<tt_stats_role>";
GRANT SELECT ON TABLE public.users, public.videos, public.music
TO "<tt_stats_role>";`}</SetupCode>
          </li>
          <li>
            Return here, refresh diagnostics, confirm the limited-grants switch,
            and install the TT Stats schema and fixed jobs. After a successful
            install, database <code>CREATE</code> may be revoked for normal
            runtime and temporarily re-granted before an in-app repair.
          </li>
        </ol>
        <p>
          Scheduled refreshes still need <code>CONNECT</code>,{" "}
          <code>TEMPORARY</code>, <code>USAGE</code> on <code>cron</code>, and{" "}
          <code>SELECT</code> on the three source tables. If pg_cron uses local
          libpq connections, its job role must also pass your{" "}
          <code>pg_hba.conf</code> authentication; background-worker mode is an
          alternative.
        </p>
        <a
          className="w-fit underline underline-offset-4 hover:text-foreground"
          href="https://github.com/citusdata/pg_cron#setting-up-pg_cron"
          target="_blank"
          rel="noreferrer"
        >
          Official pg_cron setup reference
        </a>
      </AlertDescription>
    </Alert>
  )
}

function SetupCode({ children }: { children: string }) {
  return (
    <pre className="mt-2 max-w-full overflow-x-auto rounded-md border bg-muted p-3 text-xs text-foreground">
      <code>{children}</code>
    </pre>
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
