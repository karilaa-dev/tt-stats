import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Menu } from "@base-ui/react/menu"
import { RefreshCwIcon } from "lucide-react"
import { Button, Spinner } from "@/components/controls"
import { toast } from "@/components/controls/toast"
import { T, useTranslation } from "@/lib/i18n/provider"
import {
  getManualRefreshRequest,
  requestStatsJobRun,
} from "@/lib/stats/functions"
import { statsJobsQueryOptions, statsQueryKey } from "@/lib/stats/query-options"
import type { StatsDataset, StatsJob } from "@/lib/stats/types"
import { invalidateSnapshotViews } from "@/lib/stats/snapshot-refresh"

export function StatsRefresh({ fakeMode }: { fakeMode: boolean }) {
  const { t } = useTranslation()
  const jobs = useQuery(statsJobsQueryOptions())
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={t("Update now")}
        render={<Button variant="outline" className="stats-refresh-trigger" />}
      >
        <RefreshCwIcon aria-hidden="true" />
        <span className="stats-refresh-label">{t("Update now")}</span>
      </Menu.Trigger>
      <Menu.Portal keepMounted>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="stats-refresh-menu">
            {(["rolling_24h", "daily"] as const).map((dataset) => (
              <RefreshDataset
                key={dataset}
                dataset={dataset}
                job={jobs.data?.find((job) => job.dataset === dataset)}
                disabled={fakeMode || !jobs.data}
              />
            ))}
            {jobs.isError && (
              <p role="alert">{t("Refresh status could not be checked")}</p>
            )}
            <Menu.Item
              render={<a href="/dashboard/jobs" />}
              className="stats-refresh-item"
            >
              {t("Open Operations")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
function RefreshDataset({
  dataset,
  job,
  disabled,
}: {
  dataset: StatsDataset
  job?: StatsJob
  disabled: boolean
}) {
  const client = useQueryClient()
  const [requestId, setRequestId] = useState<string | null>(null)
  const id = requestId ?? job?.pendingRequest?.id
  const reported = useRef<string | null>(null)
  const request = useQuery({
    queryKey: [...statsQueryKey, "jobs", "manual", id],
    queryFn: () => getManualRefreshRequest({ data: { requestId: id! } }),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      ["succeeded", "failed"].includes(query.state.data?.status ?? "")
        ? false
        : 5_000,
  })
  const mutation = useMutation({
    mutationFn: () => requestStatsJobRun({ data: { dataset } }),
    onSuccess: ({ requestId }) => {
      setRequestId(requestId)
      void client.invalidateQueries({ queryKey: [...statsQueryKey, "jobs"] })
    },
    onError: () =>
      toast.error("The refresh failed. Existing statistics remain available."),
  })
  const status = request.data?.status ?? job?.pendingRequest?.status
  const pending =
    mutation.isPending || status === "queued" || status === "running"
  useEffect(() => {
    if (
      !id ||
      reported.current === id ||
      (status !== "succeeded" && status !== "failed")
    )
      return
    reported.current = id
    if (status === "succeeded") {
      void invalidateSnapshotViews(client, dataset)
      void client.invalidateQueries({
        queryKey: [...statsQueryKey, "metadata"],
      })
      toast.success("Statistics updated.")
    } else
      toast.error("The refresh failed. Existing statistics remain available.")
    void client.invalidateQueries({ queryKey: [...statsQueryKey, "jobs"] })
  }, [id, status, client, dataset])
  return (
    <Menu.Item
      className="stats-refresh-item"
      closeOnClick={false}
      disabled={disabled || !job?.schedule || pending}
      onClick={() => mutation.mutate()}
    >
      <span>
        <T>
          {dataset === "rolling_24h" ? "Recent statistics" : "Daily statistics"}
        </T>
      </span>
      <span role="status" className="text-xs text-muted-foreground">
        {pending && <Spinner />}
        <T>
          {mutation.isPending
            ? "Queued"
            : status === "succeeded"
              ? "Completed"
              : status === "failed"
                ? "Failed"
                : status === "running"
                  ? "Running"
                  : status === "queued"
                    ? "Queued"
                    : ""}
        </T>
      </span>
    </Menu.Item>
  )
}
