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
      key: "downloads",
      label: "Video downloads",
      value: count(stats.downloads.total),
      detail: `${count(stats.downloads.uniqueUsers)} unique chats`,
      icon: DownloadIcon,
    },
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
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
        cacheDisplay === "counts" ? "2xl:grid-cols-6" : "xl:grid-cols-5"
      )}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card
            key={metric.key}
            className={cn(
              "min-w-0",
              cacheDisplay === "percentage" &&
                metric.key === "downloads" &&
                "sm:col-span-2 xl:col-span-1"
            )}
          >
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
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
                  "font-heading text-3xl font-semibold tracking-tight break-all tabular-nums",
                  metric.key === "downloads" && "text-primary"
                )}
              >
                {metric.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {metric.detail}
              </p>
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
    <div className="flex flex-col justify-center rounded-lg bg-muted/50 p-4">
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
