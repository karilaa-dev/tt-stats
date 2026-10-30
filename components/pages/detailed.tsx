import { T, useTranslation } from "@/lib/i18n/provider"
import {
  useDashboardSearch,
  useDashboardNavigate,
} from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowUpRightIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  ImagesIcon,
  InfoIcon,
  InstagramLogoIcon,
  MusicNotesIcon,
  TiktokLogoIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { ExactCounter } from "@/components/dashboard/exact-counter"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { StatsFilters } from "@/components/dashboard/stats-filters"
import {
  PlatformToggle,
  platformOptions,
  type VideoPlatform,
} from "@/components/dashboard/platform-filter"
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldLabel,
} from "@/components/controls"
import { statsBreakdownQueryOptions } from "@/lib/stats/query-options"
import type { StatsBreakdown } from "@/lib/stats/types"
import { cn } from "@/lib/utils"

import "./detailed.css"

type NamedPlatform = VideoPlatform

export function DetailedPage() {
  const { t } = useTranslation()

  const { scope, range, platform } = useDashboardSearch()
  const navigate = useDashboardNavigate()
  const statsQuery = useQuery(
    statsBreakdownQueryOptions(scope, range, platform)
  )
  // Never show another platform's counts under the selected platform's labels.
  const stats = statsQuery.isPlaceholderData ? undefined : statsQuery.data
  const audience = {
    users: "Private users",
    groups: "Groups",
    all: "All chats",
  }[scope]
  const period = {
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "31d": "Last 31 days",
    all: "All time",
  }[range]
  const platformLabel = platformOptions.find(
    (option) => option.value === platform
  )!.label
  return (
    <>
      <PageHeading
        title={t("Breakdown")}
        description={t(
          "Explore downloads by platform, audience, and reporting period."
        )}
      />
      <div className="breakdown-filters">
        <div className="stats-filters">
          <Field className="stats-filter">
            <FieldLabel>
              <T>{"Platform"}</T>
            </FieldLabel>
            <PlatformToggle
              className="breakdown-platform-toggle"
              value={platform}
              onValueChange={(nextPlatform) =>
                navigate({
                  search: (previous) => ({
                    ...previous,
                    platform: nextPlatform,
                  }),
                })
              }
              aria-label={t("Download platform")}
            />
          </Field>
        </div>
        <StatsFilters
          scope={scope}
          range={range}
          onScopeChange={(nextScope) =>
            navigate({
              search: (previous) => ({ ...previous, scope: nextScope }),
            })
          }
          onRangeChange={(nextRange) =>
            navigate({
              search: (previous) => ({ ...previous, range: nextRange }),
            })
          }
        />
      </div>
      <div className="section-heading">
        <div>
          <h2>
            {platform === "all" ? null : (
              <>
                <T>{platformLabel}</T>
                <span className="breakdown-heading-separator">{" · "}</span>
              </>
            )}
            <T>{audience}</T>
          </h2>
          <p>
            <T>{period}</T>
            <T>{" · Downloads, formats, and cache usage"}</T>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a
              href={`/dashboard/analytics${range === "24h" ? "" : `?range=${range}`}`}
            />
          }
        >
          <T>
            {platform === "all"
              ? "View activity over time "
              : "View all-platform trends"}
          </T>
          <ArrowUpRightIcon data-icon="inline-end" />
        </Button>
      </div>
      <T>
        {statsQuery.isError && !stats ? (
          <DashboardError
            error={statsQuery.error}
            reset={() => void statsQuery.refetch()}
          />
        ) : stats ? (
          platform === "all" ? (
            <StatsCards stats={stats} />
          ) : (
            <PlatformBreakdown
              key={platform}
              platform={platform}
              stats={stats}
            />
          )
        ) : (
          <DashboardLoading count={platform === "instagram" ? 4 : undefined} />
        )}
      </T>
    </>
  )
}

/**
 * Platform-attributed download metrics. Registered chats are a global count, so
 * they stay on the All platforms view rather than appearing as a platform total.
 */
function PlatformBreakdown({
  platform,
  stats,
}: {
  platform: NamedPlatform
  stats: StatsBreakdown
}) {
  const { locale } = useTranslation()
  const count = (value: string) => BigInt(value).toLocaleString(locale)
  const percent = (part: bigint, total: bigint) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
    }).format(
      total === 0n ? 0 : Number((part * 1000n + total / 2n) / total) / 1000
    )
  const total = BigInt(stats.downloads.total)
  const cacheHits = BigInt(stats.downloads.cacheHits)
  const cacheMisses = total - cacheHits
  const hasMusic = platform === "tiktok"
  const copy = {
    tiktok: {
      downloads: "TikTok downloads",
      empty: "No TikTok downloads in this period",
    },
    instagram: {
      downloads: "Instagram downloads",
      empty: "No Instagram downloads in this period",
    },
  }[platform]

  if (total === 0n && (!hasMusic || BigInt(stats.music.total) === 0n)) {
    return (
      <div className="breakdown-platform">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {platform === "tiktok" ? (
                <TiktokLogoIcon aria-hidden="true" />
              ) : (
                <InstagramLogoIcon aria-hidden="true" />
              )}
            </EmptyMedia>
            <EmptyTitle>
              <T>{copy.empty}</T>
            </EmptyTitle>
            <EmptyDescription>
              <T>
                {
                  "Try a longer period or another audience. Downloads without platform information appear only under All platforms."
                }
              </T>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const metrics = [
    {
      key: "downloads",
      label: copy.downloads,
      value: stats.downloads.total,
      detail: `${count(stats.downloads.uniqueUsers)} unique chats`,
      icon: DownloadSimpleIcon,
    },
    ...(hasMusic
      ? [
          {
            key: "music",
            label: "Music downloads",
            value: stats.music.total,
            detail: `${count(stats.music.uniqueUsers)} unique chats`,
            icon: MusicNotesIcon,
          },
        ]
      : []),
    {
      key: "images",
      label: "Image albums",
      value: stats.downloads.images,
      detail: `${count(stats.downloads.uniqueImageUsers)} unique chats`,
      icon: ImagesIcon,
    },
    {
      key: "cacheHits",
      label: "Cache hits",
      value: cacheHits.toString(),
      detail: `${percent(cacheHits, total)} hit rate`,
      icon: DatabaseIcon,
    },
    {
      key: "cacheMisses",
      label: "Cache misses",
      value: cacheMisses.toString(),
      detail: `${percent(cacheMisses, total)} miss rate`,
      icon: WarningOctagonIcon,
    },
  ]

  return (
    <div className="breakdown-platform">
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          hasMusic ? "lg:grid-cols-3 2xl:grid-cols-5" : "xl:grid-cols-4"
        )}
      >
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card
              key={metric.key}
              className={cn(
                "min-w-0",
                hasMusic &&
                  metric.key === "downloads" &&
                  "sm:col-span-2 lg:col-span-1"
              )}
            >
              <CardHeader>
                <CardDescription>
                  <T>{metric.label}</T>
                </CardDescription>
                <CardAction>
                  <Icon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-semibold break-all tabular-nums",
                    metric.key === "downloads" && "text-primary"
                  )}
                >
                  <ExactCounter value={metric.value} />
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <T>{metric.detail}</T>
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <ul className="breakdown-platform-notes">
        <li>
          <InfoIcon aria-hidden="true" />
          <span>
            <T>
              {
                "Downloads include videos and image albums. Older downloads without platform information appear only under All platforms."
              }
            </T>
          </span>
        </li>
        <li>
          <InfoIcon aria-hidden="true" />
          <span>
            <T>
              {
                "Registered chats are shared across platforms and appear only under All platforms."
              }
            </T>
          </span>
        </li>
        {hasMusic ? null : (
          <li>
            <InfoIcon aria-hidden="true" />
            <span>
              <T>{"Music downloads are available for TikTok only."}</T>
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}
