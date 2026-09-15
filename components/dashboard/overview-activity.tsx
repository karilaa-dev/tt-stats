import { T, useTranslation } from "@/lib/i18n/provider"
import { ExactCounter } from "./exact-counter"
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

import { Button } from "@/components/controls"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/controls"
import { Skeleton } from "@/components/controls"
import { TelegramMauCard } from "./telegram-mau-card"
import { formatEpoch, useBrowserTime } from "@/lib/browser-time"
import { timeSeriesQueryOptions } from "@/lib/stats/query-options"
import type { StatsBreakdown, TimeSeriesPoint } from "@/lib/stats/types"
import "./overview-activity.css"

export function OverviewActivity({
  recent,
  lifetime,
  scope,
}: {
  recent: StatsBreakdown
  lifetime: StatsBreakdown
  scope: "users" | "groups"
}) {
  const { t, locale } = useTranslation()
  const count = (value: string) => BigInt(value).toLocaleString(locale)

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
            <CardTitle>
              <T>{"Daily activity"}</T>
            </CardTitle>
            <CardDescription>
              <T>{scope === "users" ? "Private users" : "Groups"}</T>
              <T>{" · completed 24-hour window"}</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overview-primary-metric">
              <div>
                <p className="overview-metric-label">
                  <T>{"Video downloads"}</T>
                </p>
                <p className="overview-big-number">
                  <ExactCounter value={recent.downloads.total} />
                </p>
                <p className="overview-metric-note">
                  <T>{"Downloaded by "}</T>
                  <T>{count(recent.downloads.uniqueUsers)}</T>
                  <T>{" unique chats"}</T>
                </p>
              </div>
              <DownloadIcon
                className="overview-download-mark"
                aria-hidden="true"
              />
            </div>
            <dl className="overview-supporting-metrics">
              <T>
                {supporting.map(({ label, value, icon: Icon }) => (
                  <div key={label}>
                    <dt>
                      <Icon aria-hidden="true" /> <T>{label}</T>
                    </dt>
                    <dd>
                      <T>{count(value)}</T>
                    </dd>
                  </div>
                ))}
              </T>
            </dl>
          </CardContent>
        </Card>
        <Card className="overview-cache-card">
          <CardHeader>
            <CardTitle>
              <T>{"Cache efficiency"}</T>
            </CardTitle>
            <CardDescription>
              <T>{"How downloads were delivered"}</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="overview-cache-ring"
              role="img"
              aria-label={t(
                `${rate.toLocaleString(locale, { minimumFractionDigits: 1 })}% of downloads served from cache`
              )}
            >
              <svg viewBox="0 0 160 160" aria-hidden="true">
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke="var(--chart-2)"
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
                  <T>
                    {rate.toLocaleString(locale, { minimumFractionDigits: 1 })}
                  </T>
                  <small>%</small>
                </strong>
                <span>
                  <T>{"served from cache"}</T>
                </span>
              </div>
            </div>
            <dl className="overview-cache-legend">
              <div>
                <dt>
                  <i aria-hidden="true" />
                  <T>{"Cache hits"}</T>
                </dt>
                <dd>
                  <T>{count(recent.downloads.cacheHits)}</T>
                </dd>
              </div>
              <div>
                <dt>
                  <i aria-hidden="true" />
                  <T>{"Cache misses"}</T>
                </dt>
                <dd>
                  <T>{count((total - hits).toString())}</T>
                </dd>
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
              <CardTitle>
                <T>{"All time"}</T>
              </CardTitle>
              <CardDescription>
                <T>{scope === "users" ? "Private users" : "Groups"}</T>
                <T>{" · through completed UTC days"}</T>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="overview-lifetime-ledger">
                <T>
                  {lifetimeMetrics.map(({ label, value }) => (
                    <div key={label}>
                      <dt>
                        <T>{label}</T>
                      </dt>
                      <dd>
                        <T>{count(value)}</T>
                      </dd>
                    </div>
                  ))}
                </T>
              </dl>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={`/dashboard/detailed?scope=${scope}&range=all`} />
                }
                className="overview-ledger-link"
              >
                <T>{"See full breakdown "}</T>
                <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <div
        className="overview-shortcuts"
        aria-label={t("Explore bot statistics")}
      >
        <a href="/dashboard/analytics?range=24h">
          <ChartNoAxesCombinedIcon aria-hidden="true" />
          <span>
            <strong>
              <T>{"Find the pattern"}</T>
            </strong>
            <small>
              <T>{"Explore download and audience trends"}</T>
            </small>
          </span>
          <ArrowUpRightIcon aria-hidden="true" />
        </a>
        <a href="/dashboard/users">
          <SearchIcon aria-hidden="true" />
          <span>
            <strong>
              <T>{"Look up a chat"}</T>
            </strong>
            <small>
              <T>{"Find activity by Telegram ID"}</T>
            </small>
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
        <CardTitle>
          <T>{"Bot traffic"}</T>
        </CardTitle>
        <CardDescription>
          <T>{"All chats · last 24 hours · 30-minute intervals"}</T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <T>
          {query.data?.length ? (
            <TrafficPlot points={query.data} />
          ) : query.isError ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  <T>{"Traffic is unavailable"}</T>
                </EmptyTitle>
                <EmptyDescription>
                  <T>{"The activity totals above are still available."}</T>
                </EmptyDescription>
              </EmptyHeader>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
              >
                <T>{"Retry chart"}</T>
              </Button>
            </Empty>
          ) : query.data ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  <T>{"No traffic in this window"}</T>
                </EmptyTitle>
                <EmptyDescription>
                  <T>{"Open Trends to explore a longer reporting period."}</T>
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Skeleton className="h-52 w-full" />
          )}
        </T>
      </CardContent>
    </Card>
  )
}

function TrafficPlot({ points }: { points: TimeSeriesPoint[] }) {
  const { t, locale } = useTranslation()

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
        aria-label={t(
          `Video and image deliveries across all chats. ${points.length} half-hour intervals. Peak ${peak.toLocaleString(locale)} downloads.`
        )}
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
              {label(point.bucketEpoch)}: {point.count.toLocaleString(locale)}{" "}
              downloads
            </title>
          </circle>
        ))}
      </svg>
      <div className="overview-chart-axis" aria-hidden="true">
        <span>
          <T>{label(start)}</T>
        </span>
        <span>
          <T>{label(Math.round((start + end) / 2))}</T>
        </span>
        <span>
          <T>{label(end)}</T>
        </span>
      </div>
      <figcaption>
        <span>
          <T>{"Peak"}</T>{" "}
          <strong>
            <T>
              {Math.max(...points.map((point) => point.count)).toLocaleString(
                locale
              )}
            </T>
          </strong>{" "}
          <T>{"downloads / 30 min"}</T>
        </span>
        <span>
          <T>{time.timeZone}</T>
        </span>
      </figcaption>
    </figure>
  )
}
