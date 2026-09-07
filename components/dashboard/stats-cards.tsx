import {
  DatabaseXIcon,
  DatabaseZapIcon,
  DownloadIcon,
  ImagesIcon,
  Music2Icon,
  UsersIcon,
} from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { StatsBreakdown } from "@/lib/stats/types"
import { cn } from "@/lib/utils"

function count(value: string) {
  return BigInt(value).toLocaleString("en-US")
}

function percentage(part: string, total: string): string {
  const denominator = BigInt(total)
  if (denominator === 0n) return "0.0%"
  const numerator = BigInt(part)
  const tenths = (numerator * 1000n + denominator / 2n) / denominator
  return `${tenths / 10n}.${tenths % 10n}%`
}

export function StatsCards({
  stats,
  cacheDisplay = "counts",
}: {
  stats: StatsBreakdown
  cacheDisplay?: "counts" | "percentage"
}) {
  const cacheMisses = (
    BigInt(stats.downloads.total) - BigInt(stats.downloads.cacheHits)
  ).toString()
  const metrics = [
    {
      key: "chats",
      label: "Registered chats",
      value: count(stats.chats),
      detail: "Users or groups registered",
      icon: UsersIcon,
    },
    {
      key: "music",
      label: "Music downloads",
      value: count(stats.music.total),
      detail: `${count(stats.music.uniqueUsers)} unique chats`,
      icon: Music2Icon,
    },
    {
      key: "downloads",
      label: "Video downloads",
      value: count(stats.downloads.total),
      detail: `${count(stats.downloads.uniqueUsers)} unique chats`,
      icon: DownloadIcon,
    },
    {
      key: "images",
      label: "Image albums",
      value: count(stats.downloads.images),
      detail: `${count(stats.downloads.uniqueImageUsers)} unique chats`,
      icon: ImagesIcon,
    },
    ...(cacheDisplay === "percentage"
      ? [
          {
            key: "cacheRate",
            label: "Cache hit rate",
            value: percentage(stats.downloads.cacheHits, stats.downloads.total),
            detail: "Downloads served from cache",
            icon: DatabaseZapIcon,
          },
        ]
      : [
          {
            key: "cacheHits",
            label: "Cache hits",
            value: count(stats.downloads.cacheHits),
            detail: `${percentage(stats.downloads.cacheHits, stats.downloads.total)} hit rate`,
            icon: DatabaseZapIcon,
          },
          {
            key: "cacheMisses",
            label: "Cache misses",
            value: count(cacheMisses),
            detail: `${percentage(cacheMisses, stats.downloads.total)} miss rate`,
            icon: DatabaseXIcon,
          },
        ]),
  ]

  return (
    <div
      className={cn(
        "grid sm:grid-cols-2",
        cacheDisplay === "percentage"
          ? "gap-3"
          : "gap-4 lg:grid-cols-3 2xl:grid-cols-6"
      )}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card
            key={metric.key}
            size={cacheDisplay === "percentage" ? "sm" : "default"}
            className={cn(
              cacheDisplay === "percentage" &&
                metric.key === "cacheRate" &&
                "sm:col-span-2"
            )}
          >
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle
                className={cn(
                  "font-semibold tabular-nums",
                  cacheDisplay === "percentage"
                    ? "text-xl sm:text-2xl"
                    : "text-2xl sm:text-3xl"
                )}
              >
                {metric.value}
              </CardTitle>
              <CardAction>
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" aria-hidden="true" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs font-medium text-muted-foreground">
              {metric.detail}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function CachePerformanceCard({ stats }: { stats: StatsBreakdown }) {
  const misses = (
    BigInt(stats.downloads.total) - BigInt(stats.downloads.cacheHits)
  ).toString()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cache performance</CardTitle>
        <CardDescription>
          Download delivery in the selected period
        </CardDescription>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DatabaseZapIcon className="size-4.5" aria-hidden="true" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="grid flex-1 gap-3 sm:grid-cols-2">
        <CacheMetric
          label="Cache hits"
          value={stats.downloads.cacheHits}
          rate={percentage(stats.downloads.cacheHits, stats.downloads.total)}
        />
        <CacheMetric
          label="Cache misses"
          value={misses}
          rate={percentage(misses, stats.downloads.total)}
        />
      </CardContent>
    </Card>
  )
}

function CacheMetric({
  label,
  value,
  rate,
}: {
  label: string
  value: string
  rate: string
}) {
  return (
    <div className="flex min-h-32 flex-col justify-center rounded-lg bg-muted/50 p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
        {count(value)}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {rate} of downloads
      </p>
    </div>
  )
}
