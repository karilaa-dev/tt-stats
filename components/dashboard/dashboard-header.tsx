"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SunIcon,
} from "lucide-react"

import { logoutAction, refreshStatsAction } from "@/app/actions"
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

const labels: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/analytics": "Analytics",
  "/dashboard/detailed": "Detailed",
  "/dashboard/users": "User lookup",
  "/dashboard/referrals": "Referrals",
  "/dashboard/other": "Other stats",
}

export function DashboardHeader({ refreshedAt }: { refreshedAt?: number }) {
  const pathname = usePathname()
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
      <form action={refreshStatsAction}>
        <Tooltip>
          <TooltipTrigger
            render={<Button type="submit" variant="ghost" size="icon-sm" />}
          >
            <RefreshCwIcon />
            <span className="sr-only">Refresh statistics</span>
          </TooltipTrigger>
          <TooltipContent>Refresh statistics</TooltipContent>
        </Tooltip>
      </form>
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
      <form action={logoutAction}>
        <Tooltip>
          <TooltipTrigger
            render={<Button type="submit" variant="ghost" size="icon-sm" />}
          >
            <LogOutIcon />
            <span className="sr-only">Sign out</span>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </form>
    </header>
  )
}
