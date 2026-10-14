import "@/lib/server-only"
import type { AstroCookies } from "astro"
import {
  dehydrate,
  QueryClient,
  type DehydratedState,
} from "@tanstack/react-query"
import { getPrincipal } from "@/lib/auth/session"
import { getOAuthEnv } from "@/lib/auth/telegram"
import type { BrowserSession, Principal } from "@/lib/auth/types"
import { parseDashboardSearch } from "@/lib/dashboard-search"
import { getFakeUserStats, isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getCachedUserStats } from "@/lib/stats/cached"
import { parseTelegramId } from "@/lib/stats/validation"
import { localeFromRequest, type Locale } from "@/lib/i18n/locale"
import { queryKeys } from "@/lib/stats/query-keys"
import {
  loadOtherStats,
  loadOverview,
  loadPopularVideos,
  loadReferralStats,
  loadSnapshotMetadata,
  loadStatsBreakdown,
  loadTimeSeries,
  loadTelegramMau,
} from "@/lib/stats/public-data"

// Server rendering waits briefly for public statistics so pages arrive with
// content. Slower reads continue in the browser with the usual loading states.
const PREFETCH_BUDGET_MS = 1_000

export interface DashboardPageProps {
  locale: Locale
  pathname: string
  search: string
  fakeMode: boolean
  initialState: DehydratedState
}

type Load = [readonly unknown[], () => Promise<unknown>]

// Uses the same shared five-minute cache as the profile actions. A slow first
// computation keeps running and the browser's request joins it.
const loadUserStats = async (userId: string) =>
  isFakeDataEnabled() ? getFakeUserStats(userId) : getCachedUserStats(userId)

function pageLoads(
  pathname: string,
  search: string,
  principal: Principal
): Load[] {
  const { range, scope, page, id } = parseDashboardSearch(search)
  const admin = principal.admin
  switch (pathname) {
    case "/dashboard/me": {
      const user = principal.user
      return user
        ? [[queryKeys.userStats(true, user.id), () => loadUserStats(user.id)]]
        : []
    }
    case "/dashboard/users": {
      const userId = admin ? parseTelegramId(id.trim()) : null
      return userId
        ? [[queryKeys.userStats(false, userId), () => loadUserStats(userId)]]
        : []
    }
    case "/dashboard":
      return [
        [queryKeys.overview(), loadOverview],
        [
          queryKeys.timeSeries("videos", "24h"),
          () => loadTimeSeries("videos", "24h"),
        ],
        [queryKeys.telegramMau(), loadTelegramMau],
      ]
    case "/dashboard/analytics":
      return [
        ...(["users", "videos", "music"] as const).map((metric): Load => [
          queryKeys.timeSeries(metric, range),
          () => loadTimeSeries(metric, range),
        ]),
        [
          queryKeys.breakdown("all", range),
          () => loadStatsBreakdown("all", range),
        ],
      ]
    case "/dashboard/detailed":
      return [
        [
          queryKeys.breakdown(scope, range),
          () => loadStatsBreakdown(scope, range),
        ],
      ]
    case "/dashboard/videos":
      return [
        [
          queryKeys.popularVideos(range, page),
          () => loadPopularVideos(page, range),
        ],
      ]
    case "/dashboard/referrals":
      return [[queryKeys.referrals(), loadReferralStats]]
    case "/dashboard/other":
      return [
        [
          queryKeys.otherStats(),
          async () => {
            const stats = await loadOtherStats()
            return admin ? stats : { ...stats, topDownloaders: [] }
          },
        ],
      ]
    default:
      return []
  }
}

export async function dashboardPageProps({
  cookies,
  request,
  url,
}: {
  cookies: AstroCookies
  request: Request
  url: URL
}): Promise<DashboardPageProps> {
  const pathname = url.pathname.replace(/\/$/u, "") || "/"
  const principal: Principal = await getPrincipal(cookies).catch(() => ({
    user: null,
    admin: false,
  }))
  const client = new QueryClient()
  client.setQueryData<BrowserSession>(queryKeys.session(), {
    ...principal,
    loginAvailable: Boolean(getOAuthEnv()),
  })
  const loads: Load[] = [
    [queryKeys.snapshotMetadata(), loadSnapshotMetadata],
    ...pageLoads(pathname, url.search, principal),
  ]
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    Promise.allSettled(
      loads.map(async ([key, load]) => client.setQueryData(key, await load()))
    ),
    new Promise((resolve) => {
      timer = setTimeout(resolve, PREFETCH_BUDGET_MS)
    }),
  ])
  clearTimeout(timer)
  return {
    locale: localeFromRequest(cookies, request),
    pathname,
    search: url.search,
    fakeMode: isFakeDataEnabled(),
    initialState: dehydrate(client),
  }
}
