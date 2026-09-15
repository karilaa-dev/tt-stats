import { TelegramLoginButton } from "./session-access"
import { useAdminAccess } from "./admin-access"
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useHydrated } from "@/lib/dashboard-context"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "@/components/controls/toast"

import { Badge } from "@/components/controls"
import { Button } from "@/components/controls"

import { Spinner } from "@/components/controls"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/controls"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import {
  snapshotMetadataQueryOptions,
  statsQueryKey,
} from "@/lib/stats/query-options"
import { isSnapshotStale } from "@/lib/stats/staleness"

const snapshotQuerySections = new Set([
  "overview",
  "breakdown",
  "time-series",
  "referrals",
  "other",
  "popular-videos",
  "metadata",
])

function isSnapshotQuery(query: { queryKey: readonly unknown[] }) {
  return (
    query.queryKey[0] === statsQueryKey[0] &&
    snapshotQuerySections.has(String(query.queryKey[1]))
  )
}

export function DashboardHeader({ fakeMode = false }: { fakeMode?: boolean }) {
  const { authenticated } = useAdminAccess()
  const hydrated = useHydrated()
  const queryClient = useQueryClient()
  const time = useBrowserTime()
  const metadataQuery = useQuery(snapshotMetadataQueryOptions())
  const fetching = useIsFetching({ predicate: isSnapshotQuery }) > 0
  const refreshMutation = useMutation({
    mutationFn: () =>
      queryClient.refetchQueries(
        { predicate: isSnapshotQuery, type: "active" },
        { throwOnError: true }
      ),
    onError: () => {
      toast.error("The refresh failed. Existing statistics remain available.")
    },
    onSuccess: () => toast.success("Statistics updated."),
  })
  // Fetch state can change between SSR and hydration as queries settle.
  const refreshing = hydrated && (fetching || refreshMutation.isPending)
  const latestSnapshot =
    hydrated && metadataQuery.data?.length
      ? metadataQuery.data.reduce((latest, snapshot) =>
          snapshot.refreshedAt > latest.refreshedAt ? snapshot : latest
        )
      : undefined
  const staleSnapshot =
    hydrated &&
    !fakeMode &&
    metadataQuery.data?.find((snapshot) => isSnapshotStale(snapshot))

  return (
    <header className="workspace-header">
      <div className="workspace-topbar">
        <a
          href="/dashboard"
          className="brand-lockup"
          aria-label="@ttgrab Stats overview"
        >
          <img
            src="/ttgrab-logo.png"
            alt=""
            className="brand-logo"
            width="44"
            height="44"
          />
          <strong>
            @ttgrab <span>Stats</span>
          </strong>
        </a>
        <span className="topbar-divider" aria-hidden="true" />
        <span className="workspace-label">Download activity</span>
        <div className="topbar-actions">
          {refreshing ? (
            <Badge variant="outline" className="hidden sm:inline-flex">
              <Spinner /> Refreshing in background
            </Badge>
          ) : latestSnapshot && !fakeMode ? (
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Updated {formatTimestamp(latestSnapshot.refreshedAt, time)}
            </span>
          ) : null}
          {staleSnapshot ? (
            <Badge
              variant="destructive"
              render={authenticated ? <a href="/dashboard/jobs" /> : undefined}
              title="Statistics are overdue for an update."
            >
              <span className="sm:hidden">Stale</span>
              <span className="hidden sm:inline">
                {staleSnapshot.dataset === "rolling_24h" ? "Rolling" : "Daily"}{" "}
                stale
              </span>
            </Badge>
          ) : null}
          {fakeMode ? (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Demo data
            </Badge>
          ) : null}
          <TelegramLoginButton compact />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={!hydrated || refreshing}
                  onClick={() => refreshMutation.mutate()}
                />
              }
            >
              <RefreshCwIcon
                className={refreshing ? "animate-spin" : undefined}
              />
              <span className="sr-only">Refresh statistics</span>
            </TooltipTrigger>
            <TooltipContent>Refresh statistics</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
