import { T, useTranslation } from "@/lib/i18n/provider"
import { LanguageSelector } from "@/lib/i18n/provider"
import { TelegramLoginButton } from "./session-access"
import { useAdminAccess } from "./admin-access"
import { useEffect, useRef } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { useHydrated } from "@/lib/dashboard-context"
import { Badge, Spinner } from "@/components/controls"
import { StatsRefresh } from "./stats-refresh"
import { invalidateSnapshotViews } from "@/lib/stats/snapshot-refresh"
import type { StatsDataset } from "@/lib/stats/types"
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
  const { t } = useTranslation()

  const { authenticated } = useAdminAccess()
  const hydrated = useHydrated()
  const queryClient = useQueryClient()
  const time = useBrowserTime()
  const metadataQuery = useQuery(snapshotMetadataQueryOptions())
  const fetching = useIsFetching({ predicate: isSnapshotQuery }) > 0
  const versions = useRef<Partial<Record<StatsDataset, number>>>({})
  useEffect(() => {
    for (const snapshot of metadataQuery.data ?? []) {
      const previous = versions.current[snapshot.dataset]
      versions.current[snapshot.dataset] = snapshot.refreshedAt
      if (previous !== undefined && previous !== snapshot.refreshedAt) {
        void invalidateSnapshotViews(queryClient, snapshot.dataset)
      }
    }
  }, [metadataQuery.data, queryClient])
  const refreshing = hydrated && fetching
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
          aria-label={t("@ttgrab Stats overview")}
        >
          <img
            src="/ttgrab-logo.png"
            alt=""
            className="brand-logo"
            width="44"
            height="44"
          />
          <strong>
            <T>{"@ttgrab "}</T>
            <span>Stats</span>
          </strong>
        </a>
        <span className="topbar-divider" aria-hidden="true" />
        <span className="workspace-label">
          <T>{"Download activity"}</T>
        </span>
        <div className="topbar-actions">
          <T>
            {refreshing ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                <Spinner />
                <T>{" Refreshing in background"}</T>
              </Badge>
            ) : latestSnapshot && !fakeMode ? (
              <span className="hidden text-xs text-muted-foreground lg:inline">
                <T>{"Updated "}</T>
                <T>{formatTimestamp(latestSnapshot.refreshedAt, time)}</T>
              </span>
            ) : null}
          </T>
          {staleSnapshot ? (
            <Badge
              variant="destructive"
              render={authenticated ? <a href="/dashboard/jobs" /> : undefined}
              title={t("Statistics are overdue for an update.")}
            >
              <span className="sm:hidden">
                <T>{"Stale"}</T>
              </span>
              <span className="hidden sm:inline">
                <T>
                  {staleSnapshot.dataset === "rolling_24h"
                    ? "Rolling"
                    : "Daily"}
                </T>{" "}
                <T>{"stale"}</T>
              </span>
            </Badge>
          ) : null}
          <T>
            {fakeMode ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <T>{"Demo data"}</T>
              </Badge>
            ) : null}
          </T>
          <LanguageSelector />
          <TelegramLoginButton compact />
          {authenticated && <StatsRefresh fakeMode={fakeMode} />}
        </div>
      </div>
    </header>
  )
}
