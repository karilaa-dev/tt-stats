import {
  Card,
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
  { key: "chats", label: "Registered chats" },
  { key: "music", label: "Music downloads" },
  { key: "downloads", label: "Downloads" },
  { key: "images", label: "Image albums" },
] as const

export function StatsCards({ stats }: { stats: StatsBreakdown }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
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
              <CardTitle className="text-2xl tabular-nums">
                {count(total)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {detail}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
