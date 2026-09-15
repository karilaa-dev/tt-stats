import { invalidateSnapshotViews } from "@/lib/stats/snapshot-refresh"
import { T, useTranslation } from "@/lib/i18n/provider"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CirclePauseIcon,
  CirclePlayIcon,
  Clock3Icon,
  PlayIcon,
  SaveIcon,
  TriangleAlertIcon,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/controls"
import { Input } from "@/components/controls"
import { Spinner } from "@/components/controls"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/controls"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import {
  getManualRefreshRequest,
  requestStatsJobRun,
  setStatsJobActive,
  updateStatsJobSchedule,
} from "@/lib/stats/functions"
import {
  statsJobRunsQueryOptions,
  statsQueryKey,
} from "@/lib/stats/query-options"
import {
  RECOMMENDED_STATS_SCHEDULE,
  validateCronSchedule,
} from "@/lib/stats/schedule"
import type { StatsJob } from "@/lib/stats/types"

type Confirmation = "pause" | "schedule" | "run" | null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The database action failed."
}

export function StatsJobCard({
  job,
  controlsDisabled = false,
}: {
  job: StatsJob
  controlsDisabled?: boolean
}) {
  const queryClient = useQueryClient()
  const time = useBrowserTime()
  const [schedule, setSchedule] = useState(job.schedule)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [requestId, setRequestId] = useState<string | null>(
    job.pendingRequest?.id ?? null
  )
  const runsQuery = useQuery(statsJobRunsQueryOptions(job.dataset))
  const manualQuery = useQuery({
    queryKey: [...statsQueryKey, "jobs", "manual", requestId],
    queryFn: () =>
      getManualRefreshRequest({ data: { requestId: requestId ?? "0" } }),
    enabled: Boolean(requestId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "succeeded" || status === "failed" ? false : 5_000
    },
  })
  const completedRequest = useRef<string | null>(null)
  useEffect(() => {
    if (
      manualQuery.data?.status !== "succeeded" ||
      completedRequest.current === manualQuery.data.id
    )
      return
    completedRequest.current = manualQuery.data.id
    void invalidateSnapshotViews(queryClient, job.dataset)
    void queryClient.invalidateQueries({
      queryKey: [...statsQueryKey, "metadata"],
    })
  }, [manualQuery.data, queryClient, job.dataset])
  const validationError = validateCronSchedule(schedule)
  const changed = schedule.trim() !== job.schedule
  const isRecommended = job.schedule === RECOMMENDED_STATS_SCHEDULE[job.dataset]

  useEffect(() => {
    setSchedule(job.schedule)
  }, [job.schedule])

  useEffect(() => {
    if (job.pendingRequest && job.pendingRequest.id !== requestId) {
      setRequestId(job.pendingRequest.id)
    }
  }, [job.pendingRequest, requestId])

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: [...statsQueryKey, "jobs"],
    })
  }
  const scheduleMutation = useMutation({
    mutationFn: () =>
      updateStatsJobSchedule({
        data: { dataset: job.dataset, schedule: schedule.trim() },
      }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      setConfirmation(null)
      toast.success("Cron schedule saved.")
      await refresh()
    },
  })
  const activeMutation = useMutation({
    mutationFn: (active: boolean) =>
      setStatsJobActive({ data: { dataset: job.dataset, active } }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async ({ active }) => {
      setConfirmation(null)
      toast.success(active ? "Database job resumed." : "Database job paused.")
      await refresh()
    },
  })
  const runMutation = useMutation({
    mutationFn: () => requestStatsJobRun({ data: { dataset: job.dataset } }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async ({ requestId: nextRequestId }) => {
      setRequestId(nextRequestId)
      setConfirmation(null)
      toast.success("Refresh request queued in PostgreSQL.")
      await refresh()
    },
  })

  const title =
    job.dataset === "rolling_24h" ? "Rolling 24 hours" : "Daily snapshots"
  const manual = manualQuery.data ?? job.pendingRequest
  const confirmationPending =
    (confirmation === "pause" && activeMutation.isPending) ||
    (confirmation === "run" && runMutation.isPending) ||
    (confirmation === "schedule" && scheduleMutation.isPending)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>
              <T>{title}</T>
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs break-all">
              {job.jobName}
            </CardDescription>
          </div>
          <Badge variant={job.active ? "default" : "secondary"}>
            <T>{job.active ? "Active" : "Paused"}</T>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-5">
        {!job.schedule ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              <T>{"Job is not installed"}</T>
            </AlertTitle>
            <AlertDescription>
              <T>
                {
                  "Apply the pg_cron installation SQL before using these controls."
                }
              </T>
            </AlertDescription>
          </Alert>
        ) : null}
        {!isRecommended && job.schedule ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>
              <T>{"Custom cadence"}</T>
            </AlertTitle>
            <AlertDescription>
              <T>{"Recommended:"}</T>{" "}
              <code>{RECOMMENDED_STATS_SCHEDULE[job.dataset]}</code>
              <T>
                {
                  ". The current schedule can make snapshots refresh less predictably."
                }
              </T>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Datum
            label="Last snapshot"
            value={
              job.snapshot
                ? formatTimestamp(job.snapshot.refreshedAt, time)
                : "Not seeded"
            }
          />
          <Datum
            label="Completed through"
            value={
              job.snapshot
                ? formatTimestamp(job.snapshot.windowEndEpoch, time)
                : "Unavailable"
            }
          />
          <Datum label="Latest run" value={job.lastStatus ?? "No runs"} />
          <Datum
            label="Duration"
            value={
              job.lastDurationMs === null
                ? "—"
                : new Intl.NumberFormat(time.locale, {
                    style: "unit",
                    unit: "second",
                    unitDisplay: "short",
                    maximumFractionDigits: 1,
                  }).format(job.lastDurationMs / 1000)
            }
          />
        </div>

        <T>
          {manual ? (
            <Alert>
              <T>
                {manual.status === "queued" || manual.status === "running" ? (
                  <Spinner />
                ) : (
                  <Clock3Icon />
                )}
              </T>
              <AlertTitle>
                <T>{"Manual refresh "}</T>
                <T>{manual.status}</T>
              </AlertTitle>
              <AlertDescription>
                <T>{"Requested "}</T>
                <T>{formatTimestamp(manual.requestedAt, time)}</T>
                <T>
                  {manual.finishedAt
                    ? ` · Finished ${formatTimestamp(manual.finishedAt, time)}`
                    : ""}
                </T>
              </AlertDescription>
            </Alert>
          ) : null}
        </T>
        <T>
          {manualQuery.isError ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>
                <T>{"Refresh status could not be checked"}</T>
              </AlertTitle>
              <AlertDescription>
                <T>
                  {
                    "The PostgreSQL request may still be running. Reload this page or check the recent job runs before queuing another refresh."
                  }
                </T>
              </AlertDescription>
            </Alert>
          ) : null}
        </T>

        <FieldGroup>
          <Field data-invalid={Boolean(changed && validationError)}>
            <FieldLabel htmlFor={`schedule-${job.dataset}`}>
              <T>{"Cron schedule"}</T>
            </FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`schedule-${job.dataset}`}
                value={schedule}
                maxLength={101}
                spellCheck={false}
                aria-invalid={Boolean(changed && validationError)}
                disabled={controlsDisabled || !job.schedule}
                onChange={(event) => setSchedule(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  controlsDisabled ||
                  !job.schedule ||
                  !changed ||
                  Boolean(validationError) ||
                  scheduleMutation.isPending
                }
                onClick={() => setConfirmation("schedule")}
              >
                <T>
                  {scheduleMutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <SaveIcon data-icon="inline-start" />
                  )}
                </T>
                <T>{"Save"}</T>
              </Button>
            </div>
            <FieldDescription>
              <T>
                {
                  "PostgreSQL validates the expression; the SQL command and job name remain fixed."
                }
              </T>
            </FieldDescription>
            <T>
              {changed && validationError ? (
                <FieldError>
                  <T>{validationError}</T>
                </FieldError>
              ) : null}
            </T>
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              controlsDisabled ||
              !job.schedule ||
              runMutation.isPending ||
              manual?.status === "queued" ||
              manual?.status === "running"
            }
            onClick={() =>
              job.dataset === "daily"
                ? setConfirmation("run")
                : runMutation.mutate()
            }
          >
            <T>
              {runMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
            </T>
            <T>{"Run now"}</T>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              controlsDisabled || !job.schedule || activeMutation.isPending
            }
            onClick={() =>
              job.active
                ? setConfirmation("pause")
                : activeMutation.mutate(true)
            }
          >
            <T>
              {activeMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : job.active ? (
                <CirclePauseIcon data-icon="inline-start" />
              ) : (
                <CirclePlayIcon data-icon="inline-start" />
              )}
            </T>
            <T>{job.active ? "Pause" : "Resume"}</T>
          </Button>
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium">
            <T>{"Recent runs"}</T>
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T>{"Started"}</T>
                </TableHead>
                <TableHead>
                  <T>{"Status"}</T>
                </TableHead>
                <TableHead className="text-right">
                  <T>{"Duration"}</T>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsQuery.isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    <Spinner className="mr-2 inline-flex" />
                    <T>{" Loading runs…"}</T>
                  </TableCell>
                </TableRow>
              ) : runsQuery.data?.length ? (
                runsQuery.data.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <T>
                        {run.startedAt
                          ? formatTimestamp(run.startedAt, time)
                          : "—"}
                      </T>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "succeeded" ? "secondary" : "outline"
                        }
                      >
                        <T>{run.status}</T>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <T>
                        {run.durationMs === null
                          ? "—"
                          : new Intl.NumberFormat(time.locale, {
                              style: "unit",
                              unit: "second",
                              unitDisplay: "short",
                              maximumFractionDigits: 1,
                            }).format(run.durationMs / 1000)}
                      </T>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    <T>
                      {runsQuery.isError
                        ? "Run history unavailable. Check pg_cron diagnostics above."
                        : "No recorded runs."}
                    </T>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <T>{"All displayed times use "}</T>
        <T>{time.timeZone}</T>.
      </CardFooter>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              <T>
                {confirmation === "pause"
                  ? "Pause this database job?"
                  : confirmation === "run"
                    ? "Queue the daily refresh?"
                    : "Change the cron schedule?"}
              </T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T>
                {confirmation === "pause"
                  ? "Existing snapshots stay readable, but this dataset will become stale until the job resumes."
                  : confirmation === "run"
                    ? "The request returns immediately. PostgreSQL will perform the full daily aggregation when the shared refresh lock is available."
                    : `Replace ${job.schedule} with ${schedule.trim()}? PostgreSQL will keep the old schedule if validation fails.`}
              </T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmationPending}>
              <T>{"Cancel"}</T>
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={confirmationPending}
              onClick={() => {
                if (confirmation === "pause") activeMutation.mutate(false)
                else if (confirmation === "run") runMutation.mutate()
                else if (confirmation === "schedule") scheduleMutation.mutate()
              }}
            >
              <T>
                {confirmationPending ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
              </T>
              <T>{confirmationPending ? "Working…" : "Confirm"}</T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function Datum({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()

  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        <T>{label}</T>
      </p>
      <p className="mt-1 truncate text-sm font-medium" title={t(value)}>
        <T>{value}</T>
      </p>
    </div>
  )
}
