import { DownloadIcon, ImagesIcon, Music2Icon, UsersIcon } from "lucide-react"

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

const metrics = [
  { key: "chats", label: "Registered chats", icon: UsersIcon },
  { key: "music", label: "Music downloads", icon: Music2Icon },
  { key: "downloads", label: "Video downloads", icon: DownloadIcon },
  { key: "images", label: "Image albums", icon: ImagesIcon },
] as const

export function StatsCards({ stats }: { stats: StatsBreakdown }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
