import { T, useTranslation } from "@/lib/i18n/provider"
import {
  PulseIcon,
  ArrowUpRightIcon,
  CaretRightIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  DatabaseIcon,
  SquaresFourIcon,
  FunnelSimpleIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  ShareNetworkIcon,
  UserIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/controls"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/controls"
import { useRef, useState } from "react"
import { useDashboardContext } from "@/lib/dashboard-context"
import { useAdminAccess } from "./admin-access"

export const navigationGroups = ["Personal", "Statistics", "Admin"] as const

export const navigation: {
  href: string
  label: string
  short: string
  icon: typeof UserIcon
  description: string
  group: (typeof navigationGroups)[number]
}[] = [
  {
    href: "/dashboard/me",
    group: "Personal",
    label: "My profile",
    short: "My profile",
    icon: UserIcon,
    description: "Your downloads and statistics",
  },
  {
    href: "/dashboard",
    group: "Statistics",
    label: "Overview",
    short: "Home",
    icon: SquaresFourIcon,
    description: "Bot at a glance",
  },
  {
    href: "/dashboard/analytics",
    group: "Statistics",
    label: "Trends",
    short: "Trends",
    icon: ChartLineUpIcon,
    description: "Downloads over time",
  },
  {
    href: "/dashboard/detailed",
    group: "Statistics",
    label: "Breakdown",
    short: "Breakdown",
    icon: FunnelSimpleIcon,
    description: "Compare platforms, periods, and audiences",
  },
  {
    href: "/dashboard/videos",
    group: "Statistics",
    label: "Top videos",
    short: "Videos",
    icon: VideoCameraIcon,
    description: "Most downloaded videos",
  },
  {
    href: "/dashboard/referrals",
    group: "Statistics",
    label: "Referrals",
    short: "Referrals",
    icon: ShareNetworkIcon,
    description: "Where the bot audience comes from",
  },
  {
    href: "/dashboard/other",
    group: "Statistics",
    label: "Audience",
    short: "Audience",
    icon: ChartBarIcon,
    description: "Languages and download leaders",
  },
  {
    href: "/dashboard/users",
    group: "Admin",
    label: "User lookup",
    short: "Lookup",
    icon: MagnifyingGlassIcon,
    description: "Find a chat and its history",
  },
  {
    href: "/dashboard/accounts",
    group: "Admin",
    label: "Scraper accounts",
    short: "Accounts",
    icon: PulseIcon,
    description: "TikTok and Instagram account health",
  },
  {
    href: "/dashboard/jobs",
    group: "Admin",
    label: "Operations",
    short: "Operations",
    icon: DatabaseIcon,
    description: "Updates, health and notifications",
  },
]

export function AppSidebar() {
  const { t } = useTranslation()

  const { authenticated } = useAdminAccess()
  const visibleNavigation = navigation.filter(
    (item) =>
      authenticated ||
      !["/dashboard/users", "/dashboard/jobs", "/dashboard/accounts"].includes(
        item.href
      )
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
          aria-label={t("@ttgrab Stats overview")}
        >
          <img src="/ttgrab-logo.png" alt="" width="28" height="28" />
          <strong>
            <T>{"@ttgrab"}</T>
            <span>Stats</span>
          </strong>
        </a>
        <nav aria-label={t("Main navigation")}>
          {navigationGroups.map((group) => {
            const items = visibleNavigation.filter(
              (item) => item.group === group
            )
            if (!items.length) return null
            return (
              <div key={group} className="sidebar-group">
                <p className="sidebar-caption" id={`sidebar-${group}`}>
                  <T>{group}</T>
                </p>
                <ul
                  className="sidebar-menu"
                  aria-labelledby={`sidebar-${group}`}
                >
                  {items.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <a
                        href={href}
                        aria-current={current === href ? "page" : undefined}
                      >
                        <Icon
                          aria-hidden="true"
                          weight={current === href ? "fill" : "regular"}
                        />
                        <T>{label}</T>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>
        <a
          className="sidebar-bot"
          href="https://t.me/ttgrab_bot"
          target="_blank"
          rel="noreferrer"
        >
          <T>{"Open bot "}</T>
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
      </aside>
      <nav aria-label={t("Quick navigation")} className="mobile-dock">
        {quickLinks.map(({ href, short, icon: Icon }) => (
          <a
            key={href}
            href={href}
            aria-current={current === href ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span>
              <T>{short}</T>
            </span>
          </a>
        ))}
        <Button
          variant="ghost"
          className="dock-more"
          ref={moreButton}
          onClick={() => setOpenMobile(true)}
          data-active={!quickLinks.some((item) => item.href === current)}
          aria-label={t("Open all sections")}
          aria-expanded={openMobile}
        >
          <DotsThreeIcon />
          <span>
            <T>{"More"}</T>
          </span>
        </Button>
      </nav>
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent finalFocus={moreButton} className="navigation-sheet">
          <SheetHeader>
            <SheetTitle>
              <T>{"All sections"}</T>
            </SheetTitle>
            <SheetDescription>
              <T>{"Statistics, downloads and your profile."}</T>
            </SheetDescription>
          </SheetHeader>
          <nav aria-label={t("Main navigation")} className="sheet-navigation">
            {visibleNavigation.map(
              ({ href, label, description, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  aria-current={current === href ? "page" : undefined}
                  aria-label={t(label)}
                  onClick={() => setOpenMobile(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>
                      <T>{label}</T>
                    </strong>
                    <small>
                      <T>{description}</T>
                    </small>
                  </span>
                  <CaretRightIcon aria-hidden="true" />
                </a>
              )
            )}
          </nav>
          <div className="sheet-workspace">
            <PulseIcon aria-hidden="true" />
            <T>
              {fakeMode ? "Demo workspace · sample data" : "tt-bot workspace"}
            </T>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
