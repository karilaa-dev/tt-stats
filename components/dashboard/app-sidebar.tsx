import {
  ActivityIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  DatabaseZapIcon,
  LayoutDashboardIcon,
  ListFilterIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Share2Icon,
  VideoIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useSidebar } from "@/components/ui/sidebar"
import { useDashboardContext } from "@/lib/dashboard-context"
import { useAdminAccess } from "./admin-access"

const navigation = [
  {
    href: "/dashboard",
    label: "Overview",
    short: "Home",
    icon: LayoutDashboardIcon,
    description: "Your bot at a glance",
  },
  {
    href: "/dashboard/analytics",
    label: "Trends",
    short: "Trends",
    icon: ChartNoAxesCombinedIcon,
    description: "Downloads over time",
  },
  {
    href: "/dashboard/detailed",
    label: "Breakdown",
    short: "Breakdown",
    icon: ListFilterIcon,
    description: "Compare periods and audiences",
  },
  {
    href: "/dashboard/users",
    label: "User lookup",
    short: "Lookup",
    icon: SearchIcon,
    description: "Find a chat and its history",
  },
  {
    href: "/dashboard/videos",
    label: "Top videos",
    short: "Videos",
    icon: VideoIcon,
    description: "Most downloaded videos",
  },
  {
    href: "/dashboard/referrals",
    label: "Referrals",
    short: "Referrals",
    icon: Share2Icon,
    description: "Where your audience comes from",
  },
  {
    href: "/dashboard/other",
    label: "Audience",
    short: "Audience",
    icon: BarChart3Icon,
    description: "Languages and download leaders",
  },
  {
    href: "/dashboard/jobs",
    label: "Operations",
    short: "Operations",
    icon: DatabaseZapIcon,
    description: "Updates, health and notifications",
  },
]

export function DesktopNavigation() {
  const { requireAdmin } = useAdminAccess()
  const { pathname } = useDashboardContext()
  const current = pathname.replace(/\/$/, "")
  return (
    <nav aria-label="Main navigation" className="desktop-navigation">
      {navigation.map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          onClick={async (event) => {
            if (href !== "/dashboard/jobs") return
            event.preventDefault()
            if (await requireAdmin()) window.location.assign(href)
          }}
          aria-current={current === href ? "page" : undefined}
        >
          <Icon aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  )
}

export function AppSidebar() {
  const { requireAdmin } = useAdminAccess()
  const { pathname, fakeMode } = useDashboardContext()
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const current = pathname.replace(/\/$/, "")
  const quickLinks = navigation.filter((item) =>
    ["/dashboard", "/dashboard/analytics", "/dashboard/users"].includes(
      item.href
    )
  )
  return (
    <>
      <nav aria-label="Quick navigation" className="mobile-dock">
        {quickLinks.map(({ href, short, icon: Icon }) => (
          <a
            key={href}
            href={href}
            aria-current={current === href ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{short}</span>
          </a>
        ))}
        <Button
          variant="ghost"
          className="dock-more"
          onClick={() => setOpenMobile(true)}
          data-active={!quickLinks.some((item) => item.href === current)}
          aria-label="Open all sections"
          aria-expanded={openMobile}
        >
          <MoreHorizontalIcon />
          <span>More</span>
        </Button>
      </nav>
      {isMobile ? (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent side="bottom" className="navigation-sheet">
            <SheetHeader>
              <SheetTitle>Your workspace</SheetTitle>
              <SheetDescription>
                Explore activity, understand your audience, and keep your bot
                running.
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="Main navigation" className="sheet-navigation">
              {navigation.map(({ href, label, description, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  aria-current={current === href ? "page" : undefined}
                  aria-label={label}
                  onClick={async (event) => {
                    setOpenMobile(false)
                    if (href !== "/dashboard/jobs") return
                    event.preventDefault()
                    if (await requireAdmin()) window.location.assign(href)
                  }}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowUpRightIcon aria-hidden="true" />
                </a>
              ))}
            </nav>
            <div className="sheet-workspace">
              <ActivityIcon aria-hidden="true" />
              {fakeMode ? "Demo workspace · sample data" : "tt-bot workspace"}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  )
}
