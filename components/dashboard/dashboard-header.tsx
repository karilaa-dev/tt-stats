import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useHydrated, useDashboardContext } from "@/lib/dashboard-context"
import { useTheme } from "next-themes"
import {
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SunIcon,
  SearchIcon,
  CheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
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
  "/dashboard/analytics": "Trends",
  "/dashboard/detailed": "Breakdown",
  "/dashboard/users": "User lookup",
  "/dashboard/referrals": "Referrals",
  "/dashboard/other": "Audience insights",
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
  const hydrated = useHydrated()
  const { pathname } = useDashboardContext()
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
  const { theme, setTheme } = useTheme()
  const label = labels[pathname.replace(/\/$/, "")] ?? "Dashboard"
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
    <header className="workspace-header sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-8">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink>
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
      ) : latestSnapshot && !fakeMode ? (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          Updated {formatTimestamp(latestSnapshot.refreshedAt, time)}
        </span>
      ) : null}
      {staleSnapshot ? (
        <Badge
          variant="destructive"
          render={<a href="/dashboard/jobs" />}
          title="Statistics are overdue for an update. Check database jobs."
        >
          <span className="sm:hidden">Stale</span>
          <span className="hidden sm:inline">
            {staleSnapshot.dataset === "rolling_24h" ? "Rolling" : "Daily"}{" "}
            stale
          </span>
        </Badge>
      ) : null}
      {fakeMode ? <Badge variant="secondary">Demo data</Badge> : null}
      <Button
        variant="outline"
        render={<a href="/dashboard/users" />}
        nativeButton={false}
        className="ml-2 hidden md:inline-flex"
      >
        <SearchIcon data-icon="inline-start" />
        Find a user
      </Button>
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
          <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
          <span className="sr-only">Refresh statistics</span>
        </TooltipTrigger>
        <TooltipContent>Refresh statistics</TooltipContent>
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
              {hydrated && theme === "light" ? (
                <CheckIcon className="ml-auto" aria-label="Selected" />
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <MoonIcon /> Dark
              {hydrated && theme === "dark" ? (
                <CheckIcon className="ml-auto" aria-label="Selected" />
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <MonitorIcon /> System
              {hydrated && theme === "system" ? (
                <CheckIcon className="ml-auto" aria-label="Selected" />
              ) : null}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
