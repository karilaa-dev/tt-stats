import {
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  DatabaseZapIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  SearchIcon,
  Share2Icon,
  ActivityIcon,
} from "lucide-react"
import { BounceSidebar } from "@/components/ui/bounce-sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useDashboardContext } from "@/lib/dashboard-context"

const navigation = [
  { label: "Activity", heading: true as const },
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: ChartNoAxesCombinedIcon,
  },
  { href: "/dashboard/detailed", label: "Detailed", icon: ListFilterIcon },
  { label: "Audience", heading: true as const },
  { href: "/dashboard/users", label: "User lookup", icon: SearchIcon },
  { href: "/dashboard/referrals", label: "Referrals", icon: Share2Icon },
  { href: "/dashboard/other", label: "Other stats", icon: BarChart3Icon },
  { label: "Operations", heading: true as const },
  { href: "/dashboard/jobs", label: "Database jobs", icon: DatabaseZapIcon },
]
export function AppSidebar() {
  const { pathname, fakeMode } = useDashboardContext()
  return (
    <Sidebar collapsible="offcanvas">
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
            <strong>TT Stats</strong>
            <small>Bot operations</small>
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main navigation" className="px-3 py-5">
          <BounceSidebar
            items={navigation}
            value={Math.max(
              0,
              navigation.findIndex((item) => item.href === pathname)
            )}
            dotColor="var(--primary)"
          />
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <div className="sidebar-status">
          <ActivityIcon aria-hidden="true" />
          <span>
            {fakeMode ? "Demo workspace" : "tt-bot workspace"}
            <small>
              {fakeMode
                ? "Explore with sample data"
                : "Download activity & audience"}
            </small>
          </span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
