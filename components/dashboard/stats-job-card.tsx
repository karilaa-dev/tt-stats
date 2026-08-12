import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CirclePauseIcon,
  CirclePlayIcon,
  Clock3Icon,
  PlayIcon,
  SaveIcon,
  TriangleAlertIcon,
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
  CardFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1 font-mono text-xs break-all">
              {job.jobName}
            </CardDescription>
          </div>
          <Badge variant={job.active ? "default" : "secondary"}>
            {job.active ? "Active" : "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-5">
        {!job.schedule ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Job is not installed</AlertTitle>
            <AlertDescription>
              Apply the pg_cron installation SQL before using these controls.
            </AlertDescription>
          </Alert>
        ) : null}
        {!isRecommended && job.schedule ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>Custom cadence</AlertTitle>
            <AlertDescription>
              Recommended:{" "}
              <code>{RECOMMENDED_STATS_SCHEDULE[job.dataset]}</code>. The
              current schedule can make snapshots refresh less predictably.
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
                : `${(job.lastDurationMs / 1000).toFixed(1)} s`
            }
          />
        </div>

        {manual ? (
          <Alert>
            {manual.status === "queued" || manual.status === "running" ? (
              <Spinner />
            ) : (
              <Clock3Icon />
            )}
            <AlertTitle>Manual refresh {manual.status}</AlertTitle>
            <AlertDescription>
              Requested {formatTimestamp(manual.requestedAt, time)}
              {manual.finishedAt
                ? ` · Finished ${formatTimestamp(manual.finishedAt, time)}`
                : ""}
            </AlertDescription>
          </Alert>
        ) : null}
        {manualQuery.isError ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Refresh status could not be checked</AlertTitle>
            <AlertDescription>
              The PostgreSQL request may still be running. Reload this page or
              check the recent job runs before queuing another refresh.
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field data-invalid={Boolean(changed && validationError)}>
            <FieldLabel htmlFor={`schedule-${job.dataset}`}>
              Cron schedule
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
                {scheduleMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                Save
              </Button>
            </div>
            <FieldDescription>
              PostgreSQL validates the expression; the SQL command and job name
              remain fixed.
            </FieldDescription>
            {changed && validationError ? (
              <FieldError>{validationError}</FieldError>
            ) : null}
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              controlsDisabled || !job.schedule || runMutation.isPending
            }
            onClick={() =>
              job.dataset === "daily"
                ? setConfirmation("run")
                : runMutation.mutate()
            }
          >
            {runMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            Run now
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
            {activeMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : job.active ? (
              <CirclePauseIcon data-icon="inline-start" />
            ) : (
              <CirclePlayIcon data-icon="inline-start" />
            )}
            {job.active ? "Pause" : "Resume"}
          </Button>
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium">Recent runs</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsQuery.isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    <Spinner className="mr-2 inline-flex" /> Loading runs…
                  </TableCell>
                </TableRow>
              ) : runsQuery.data?.length ? (
                runsQuery.data.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      {run.startedAt
                        ? formatTimestamp(run.startedAt, time)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "succeeded" ? "secondary" : "outline"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {run.durationMs === null
                        ? "—"
                        : `${(run.durationMs / 1000).toFixed(1)} s`}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    {runsQuery.isError
                      ? "Run history unavailable. Check pg_cron diagnostics above."
                      : "No recorded runs."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        All displayed times use {time.timeZone}.
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
              {confirmation === "pause"
                ? "Pause this database job?"
                : confirmation === "run"
                  ? "Queue the daily refresh?"
                  : "Change the cron schedule?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === "pause"
                ? "Existing snapshots stay readable, but this dataset will become stale until the job resumes."
                : confirmation === "run"
                  ? "The request returns immediately. PostgreSQL will perform the full daily aggregation when the shared refresh lock is available."
                  : `Replace ${job.schedule} with ${schedule.trim()}? PostgreSQL will keep the old schedule if validation fails.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmationPending}>
              Cancel
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
              {confirmationPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {confirmationPending ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  )
}
