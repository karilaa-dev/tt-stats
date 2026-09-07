import {
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  DatabaseZapIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  SearchIcon,
  Share2Icon,
  ActivityIcon,
  ArrowUpRightIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useDashboardContext } from "@/lib/dashboard-context"

const navigation = [
  {
    label: "Activity",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
      {
        href: "/dashboard/analytics",
        label: "Trends",
        icon: ChartNoAxesCombinedIcon,
      },
      { href: "/dashboard/detailed", label: "Breakdown", icon: ListFilterIcon },
    ],
  },
  {
    label: "Audience",
    items: [
      { href: "/dashboard/users", label: "User lookup", icon: SearchIcon },
      { href: "/dashboard/referrals", label: "Referrals", icon: Share2Icon },
      {
        href: "/dashboard/other",
        label: "Audience insights",
        icon: BarChart3Icon,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/dashboard/jobs",
        label: "Database jobs",
        icon: DatabaseZapIcon,
      },
    ],
  },
]

export function AppSidebar() {
  const { pathname, fakeMode } = useDashboardContext()
  const currentPath = pathname.replace(/\/$/, "")
  return (
    <Sidebar collapsible="offcanvas" className="workspace-sidebar">
      <SidebarHeader>
        <a
          href="/dashboard"
          className="brand-lockup"
          aria-label="TT Stats overview"
        >
          <span className="brand-mark" aria-hidden="true">
            <BarChart3Icon />
          </span>
          <span>
            <strong>
              TT Stats<span className="brand-period">.</span>
            </strong>
            <small>Bot analytics workspace</small>
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main navigation" className="workspace-navigation">
          {navigation.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ href, label, icon: Icon }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        render={
                          <a
                            href={href}
                            aria-current={
                              currentPath === href ? "page" : undefined
                            }
                          />
                        }
                        isActive={currentPath === href}
                        className="workspace-nav-link h-11 gap-3 px-3"
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <a className="sidebar-status" href="/dashboard/jobs">
          <ActivityIcon aria-hidden="true" />
          <span>
            {fakeMode ? "Demo workspace" : "tt-bot workspace"}
            <small>
              {fakeMode ? "Exploring sample data" : "Schedules & notifications"}
            </small>
          </span>
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
