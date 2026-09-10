import { useId } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowUpRightIcon,
  AudioLinesIcon,
  ChartNoAxesCombinedIcon,
  DownloadIcon,
  ImageIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TelegramMauCard } from "./telegram-mau-card"
import { formatEpoch, useBrowserTime } from "@/lib/browser-time"
import { timeSeriesQueryOptions } from "@/lib/stats/query-options"
import type { StatsBreakdown, TimeSeriesPoint } from "@/lib/stats/types"
import "./overview-activity.css"

const count = (value: string) => BigInt(value).toLocaleString("en-US")

export function OverviewActivity({
  recent,
  lifetime,
  scope,
}: {
  recent: StatsBreakdown
  lifetime: StatsBreakdown
  scope: "users" | "groups"
}) {
  const total = BigInt(recent.downloads.total)
  const hits = BigInt(recent.downloads.cacheHits)
  const rate = total > 0n ? Number((hits * 1000n + total / 2n) / total) / 10 : 0
  const supporting = [
    { label: "Registered chats", value: recent.chats, icon: UsersIcon },
    {
      label: "Music downloads",
      value: recent.music.total,
      icon: AudioLinesIcon,
    },
    { label: "Image albums", value: recent.downloads.images, icon: ImageIcon },
  ]
  const lifetimeMetrics = [
    { label: "Registered chats", value: lifetime.chats },
    { label: "Video downloads", value: lifetime.downloads.total },
    { label: "Music downloads", value: lifetime.music.total },
    { label: "Image albums", value: lifetime.downloads.images },
  ]

  return (
    <div className="overview-composition">
      <div className="overview-daily-grid">
        <Card className="overview-daily-card">
          <CardHeader>
            <CardTitle>Daily activity</CardTitle>
            <CardDescription>
              {scope === "users" ? "Private users" : "Groups"} · completed
              24-hour window
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overview-primary-metric">
              <div>
                <p className="overview-metric-label">Video downloads</p>
                <p className="overview-big-number">
                  {count(recent.downloads.total)}
                </p>
                <p className="overview-metric-note">
                  Downloaded by {count(recent.downloads.uniqueUsers)} unique
                  chats
                </p>
              </div>
              <DownloadIcon
                className="overview-download-mark"
                aria-hidden="true"
              />
            </div>
            <dl className="overview-supporting-metrics">
              {supporting.map(({ label, value, icon: Icon }) => (
                <div key={label}>
                  <dt>
                    <Icon aria-hidden="true" /> {label}
                  </dt>
                  <dd>{count(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="overview-cache-card">
          <CardHeader>
            <CardTitle>Cache efficiency</CardTitle>
            <CardDescription>How downloads were delivered</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="overview-cache-ring"
              role="img"
              aria-label={`${rate.toFixed(1)}% of downloads served from cache`}
            >
              <svg viewBox="0 0 160 160" aria-hidden="true">
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="14"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="14"
                  pathLength="100"
                  strokeDasharray={`${Math.min(100, Math.max(0, rate))} 100`}
                  strokeLinecap={rate > 0 ? "round" : "butt"}
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div>
                <strong>
                  {rate.toFixed(1)}
                  <small>%</small>
                </strong>
                <span>served from cache</span>
              </div>
            </div>
            <dl className="overview-cache-legend">
              <div>
                <dt>
                  <i aria-hidden="true" />
                  Cache hits
                </dt>
                <dd>{count(recent.downloads.cacheHits)}</dd>
              </div>
              <div>
                <dt>
                  <i aria-hidden="true" />
                  Cache misses
                </dt>
                <dd>{count((total - hits).toString())}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
      <div className="overview-context-grid">
        <TrafficCard />
        <div className="overview-lifetime-stack">
          <TelegramMauCard />
          <Card className="overview-lifetime-card">
            <CardHeader>
              <CardTitle>All time</CardTitle>
              <CardDescription>
                {scope === "users" ? "Private users" : "Groups"} · through
                completed UTC days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="overview-lifetime-ledger">
                {lifetimeMetrics.map(({ label, value }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count(value)}</dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={`/dashboard/detailed?scope=${scope}&range=all`} />
                }
                className="overview-ledger-link"
              >
                See full breakdown <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="overview-shortcuts" aria-label="Explore your statistics">
        <a href="/dashboard/analytics?range=24h">
          <ChartNoAxesCombinedIcon aria-hidden="true" />
          <span>
            <strong>Find the pattern</strong>
            <small>Explore download and audience trends</small>
          </span>
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
        <a href="/dashboard/users">
          <SearchIcon aria-hidden="true" />
          <span>
            <strong>Look up a chat</strong>
            <small>Find activity by Telegram ID</small>
          </span>
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

function TrafficCard() {
  const query = useQuery(timeSeriesQueryOptions("videos", "24h"))
  return (
    <Card className="overview-traffic-card">
      <CardHeader>
        <CardTitle>Bot traffic</CardTitle>
        <CardDescription>
          All chats · last 24 hours · 30-minute intervals
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.data?.length ? (
          <TrafficPlot points={query.data} />
        ) : query.isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Traffic is unavailable</EmptyTitle>
              <EmptyDescription>
                The activity totals above are still available.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              Retry chart
            </Button>
          </Empty>
        ) : query.data ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No traffic in this window</EmptyTitle>
              <EmptyDescription>
                Open Trends to explore a longer reporting period.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Skeleton className="h-52 w-full" />
        )}
      </CardContent>
    </Card>
  )
}

function TrafficPlot({ points }: { points: TimeSeriesPoint[] }) {
  const id = useId().replaceAll(":", "")
  const time = useBrowserTime()
  const peak = Math.max(...points.map((point) => point.count))
  const scaleMaximum = Math.max(1, peak)
  const start = points[0]!.bucketEpoch
  const end = points.at(-1)!.bucketEpoch
  const coordinates = points.map((point) => ({
    x: 8 + ((point.bucketEpoch - start) / Math.max(1, end - start)) * 604,
    y: 174 - (point.count / scaleMaximum) * 144,
    point,
  }))
  const path = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ")
  const label = (epoch: number) =>
    formatEpoch(epoch, time, { hour: "2-digit", minute: "2-digit" })
  return (
    <figure className="overview-traffic-figure">
      <svg
        viewBox="0 0 620 188"
        role="img"
        aria-label={`Video and image deliveries across all chats. ${points.length} half-hour intervals. Peak ${peak.toLocaleString("en-US")} downloads.`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[30, 78, 126, 174].map((y) => (
          <line
            key={y}
            x1="8"
            x2="612"
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
        ))}
        <path
          d={`${path} L${coordinates.at(-1)!.x},174 L8,174 Z`}
          fill={`url(#${id})`}
        />
        <path
          d={path}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coordinates.map(({ x, y, point }) => (
          <circle
            key={point.bucketEpoch}
            cx={x}
            cy={y}
            r="5"
            fill="transparent"
          >
            <title>
              {label(point.bucketEpoch)}: {point.count.toLocaleString("en-US")}{" "}
              downloads
            </title>
          </circle>
        ))}
      </svg>
      <div className="overview-chart-axis" aria-hidden="true">
        <span>{label(start)}</span>
        <span>{label(Math.round((start + end) / 2))}</span>
        <span>{label(end)}</span>
      </div>
      <figcaption>
        <span>
          Peak{" "}
          <strong>
            {Math.max(...points.map((point) => point.count)).toLocaleString(
              "en-US"
            )}
          </strong>{" "}
          downloads / 30 min
        </span>
        <span>{time.timeZone}</span>
      </figcaption>
    </figure>
  )
}
