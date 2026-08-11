import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { useTheme } from "next-themes"
import {
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SunIcon,
} from "lucide-react"

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { statsQueryKey } from "@/lib/stats/query-options"

const labels: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/analytics": "Analytics",
  "/dashboard/detailed": "Detailed",
  "/dashboard/users": "User lookup",
  "/dashboard/referrals": "Referrals",
  "/dashboard/other": "Other stats",
}

export function DashboardHeader({
  refreshedAt,
  fakeMode = false,
}: {
  refreshedAt?: number
  fakeMode?: boolean
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const router = useRouter()
  const queryClient = useQueryClient()
  const refreshing = useIsFetching({ queryKey: statsQueryKey }) > 0
  const { setTheme } = useTheme()
  const label = labels[pathname] ?? "Dashboard"
  const refreshed = refreshedAt
    ? new Date(refreshedAt).toLocaleTimeString("en-GB", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
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
      {refreshed ? (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          Refreshed {refreshed} UTC
        </span>
      ) : null}
      {fakeMode ? <Badge variant="secondary">Fake data</Badge> : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={refreshing}
              onClick={async () => {
                await queryClient.invalidateQueries({ queryKey: statsQueryKey })
                await router.invalidate()
              }}
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
