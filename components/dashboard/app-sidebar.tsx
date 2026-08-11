import { Link, useRouterState } from "@tanstack/react-router"
import {
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  SearchIcon,
  Share2Icon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: ChartNoAxesCombinedIcon,
  },
  { href: "/dashboard/detailed", label: "Detailed", icon: ListFilterIcon },
  { href: "/dashboard/users", label: "User lookup", icon: SearchIcon },
  { href: "/dashboard/referrals", label: "Referrals", icon: Share2Icon },
  { href: "/dashboard/other", label: "Other stats", icon: BarChart3Icon },
]

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" />}
              tooltip="TT Stats"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <BarChart3Icon />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">TT Stats</span>
                <span className="truncate text-xs">Operations dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Statistics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link to={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
