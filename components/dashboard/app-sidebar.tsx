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
  UserRoundIcon,
  VideoIcon,
} from "lucide-react"
import { Button } from "@/components/controls"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/controls"
import { useRef, useState } from "react"
import { BounceSidebar } from "@/components/rare-ui/bounce-sidebar"
import { useDashboardContext } from "@/lib/dashboard-context"
import { useAdminAccess } from "./admin-access"

const navigation = [
  {
    href: "/dashboard/me",
    label: "My Profile",
    short: "My Profile",
    icon: UserRoundIcon,
    description: "Your downloads and statistics",
  },
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

export function AppSidebar() {
  const { authenticated } = useAdminAccess()
  const visibleNavigation = navigation.filter(
    (item) =>
      authenticated ||
      !["/dashboard/users", "/dashboard/jobs"].includes(item.href)
  )
  const { pathname, fakeMode } = useDashboardContext()
  const [openMobile, setOpenMobile] = useState(false)
  const moreButton = useRef<HTMLButtonElement>(null)
  const current = pathname.replace(/\/$/, "")
  const quickLinks = [
    navigation.find((item) => item.href === "/dashboard")!,
    navigation.find((item) => item.href === "/dashboard/videos")!,
    navigation.find((item) => item.href === "/dashboard/me")!,
  ]
  return (
    <>
      <aside className="desktop-sidebar">
        <a
          href="/dashboard"
          className="sidebar-brand"
          aria-label="@ttgrab Stats overview"
        >
          <img src="/ttgrab-logo.png" alt="" width="56" height="56" />
          <strong>
            @ttgrab <span>Stats</span>
          </strong>
        </a>
        <p className="sidebar-caption">STATISTICS</p>
        <nav aria-label="Main navigation">
          <BounceSidebar
            items={visibleNavigation.map(({ href, label, icon }) => ({
              href,
              label,
              icon,
            }))}
            value={visibleNavigation.findIndex((item) => item.href === current)}
            dotColor="var(--primary)"
          />
        </nav>
        <a
          className="sidebar-bot"
          href="https://t.me/ttgrab_bot"
          target="_blank"
          rel="noreferrer"
        >
          Open bot <ArrowUpRightIcon aria-hidden="true" />
        </a>
      </aside>
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
          ref={moreButton}
          onClick={() => setOpenMobile(true)}
          data-active={!quickLinks.some((item) => item.href === current)}
          aria-label="Open all sections"
          aria-expanded={openMobile}
        >
          <MoreHorizontalIcon />
          <span>More</span>
        </Button>
      </nav>
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          finalFocus={moreButton}
          side="bottom"
          className="navigation-sheet"
        >
          <SheetHeader>
            <SheetTitle>All sections</SheetTitle>
            <SheetDescription>
              Statistics, downloads and your profile.
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Main navigation" className="sheet-navigation">
            {visibleNavigation.map(
              ({ href, label, description, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  aria-current={current === href ? "page" : undefined}
                  aria-label={label}
                  onClick={() => setOpenMobile(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowUpRightIcon aria-hidden="true" />
                </a>
              )
            )}
          </nav>
          <div className="sheet-workspace">
            <ActivityIcon aria-hidden="true" />
            {fakeMode ? "Demo workspace · sample data" : "tt-bot workspace"}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
