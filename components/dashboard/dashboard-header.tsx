import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import { useTheme } from "next-themes"
import { MonitorIcon, MoonIcon, RefreshCwIcon, SunIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import {
  snapshotMetadataQueryOptions,
  statsQueryKey,
} from "@/lib/stats/query-options"
import { isSnapshotStale } from "@/lib/stats/staleness"

const labels: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/analytics": "Analytics",
  "/dashboard/detailed": "Detailed",
  "/dashboard/users": "User lookup",
  "/dashboard/referrals": "Referrals",
  "/dashboard/other": "Other stats",
  "/dashboard/jobs": "Database jobs",
}

const snapshotQuerySections = new Set([
  "overview",
  "breakdown",
  "time-series",
  "referrals",
  "other",
  "metadata",
])

function isSnapshotQuery(query: { queryKey: readonly unknown[] }) {
  return (
    query.queryKey[0] === statsQueryKey[0] &&
    snapshotQuerySections.has(String(query.queryKey[1]))
  )
}

export function DashboardHeader({ fakeMode = false }: { fakeMode?: boolean }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const queryClient = useQueryClient()
  const time = useBrowserTime()
  const metadataQuery = useQuery(snapshotMetadataQueryOptions())
  const fetching = useIsFetching({ predicate: isSnapshotQuery }) > 0
  const refreshMutation = useMutation({
    mutationFn: () =>
      queryClient.refetchQueries({
        predicate: isSnapshotQuery,
        type: "active",
      }),
    onError: () => {
      toast.error("The refresh failed. Existing statistics remain available.")
    },
    onSuccess: () => toast.success("Snapshot views are up to date."),
  })
  const refreshing = fetching || refreshMutation.isPending
  const { setTheme } = useTheme()
  const label = labels[pathname] ?? "Dashboard"
  const latestSnapshot = metadataQuery.data?.length
    ? metadataQuery.data.reduce((latest, snapshot) =>
        snapshot.refreshedAt > latest.refreshedAt ? snapshot : latest
      )
    : undefined
  const staleSnapshot = metadataQuery.data?.find((snapshot) =>
    isSnapshotStale(snapshot)
  )

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            Dashboard
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:list-item" />
          <BreadcrumbItem>
            <BreadcrumbPage>{label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {refreshing ? (
        <Badge variant="outline" className="hidden sm:inline-flex">
          <Spinner /> Refreshing in background
        </Badge>
      ) : latestSnapshot ? (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          Snapshot {formatTimestamp(latestSnapshot.refreshedAt, time)}
        </span>
      ) : null}
      {staleSnapshot ? (
        <Badge variant="destructive">
          <span className="sm:hidden">Stale</span>
          <span className="hidden sm:inline">
            {staleSnapshot.dataset === "rolling_24h" ? "Rolling" : "Daily"}{" "}
            stale
          </span>
        </Badge>
      ) : null}
      {fakeMode ? <Badge variant="secondary">Fake data</Badge> : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            />
          }
        >
          <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
          <span className="sr-only">Refresh statistics</span>
        </TooltipTrigger>
        <TooltipContent>Re-read database snapshots</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <SunIcon />
          <span className="sr-only">Choose theme</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <SunIcon /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <MoonIcon /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <MonitorIcon /> System
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
