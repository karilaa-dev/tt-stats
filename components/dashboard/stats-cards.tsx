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

const metrics = [
  { key: "chats", label: "Registered chats", icon: UsersIcon },
  { key: "music", label: "Music downloads", icon: Music2Icon },
  { key: "downloads", label: "Video downloads", icon: DownloadIcon },
  { key: "images", label: "Image albums", icon: ImagesIcon },
  { key: "cacheHits", label: "Cache hits", icon: DatabaseZapIcon },
  { key: "cacheMisses", label: "Cache misses", icon: DatabaseXIcon },
] as const

export function StatsCards({ stats }: { stats: StatsBreakdown }) {
  const cacheMisses = (
    BigInt(stats.downloads.total) - BigInt(stats.downloads.cacheHits)
  ).toString()

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => {
        const Icon = metric.icon
        let total = stats.chats
        let detail = "Users or groups registered"
        if (metric.key === "music") {
          total = stats.music.total
          detail = `${count(stats.music.uniqueUsers)} unique chats`
        } else if (metric.key === "downloads") {
          total = stats.downloads.total
          detail = `${count(stats.downloads.uniqueUsers)} unique chats`
        } else if (metric.key === "images") {
          total = stats.downloads.images
          detail = `${count(stats.downloads.uniqueImageUsers)} unique chats`
        } else if (metric.key === "cacheHits") {
          total = stats.downloads.cacheHits
          detail = `${percentage(total, stats.downloads.total)} hit rate`
        } else if (metric.key === "cacheMisses") {
          total = cacheMisses
          detail = `${percentage(total, stats.downloads.total)} miss rate`
        }
        return (
          <Card key={metric.key}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
                {count(total)}
              </CardTitle>
              <CardAction>
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" aria-hidden="true" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="text-xs font-medium text-muted-foreground">
              {detail}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
