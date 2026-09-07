import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  BarChart3Icon,
  ChartSplineIcon,
  ChartNoAxesColumnIcon,
} from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBrowserTime } from "@/lib/browser-time"
import type { StatsRange, TimeSeriesPoint } from "@/lib/stats/types"

const TimeSeriesPlot = lazy(() => import("./time-series-plot"))

export const TimeSeriesChart = memo(function TimeSeriesChart({
  title,
  description,
  points,
  range,
  color = "var(--chart-1)",
}: {
  title: string
  description: string
  points: TimeSeriesPoint[]
  range: StatsRange
  color?: string
}) {
  const [view, setView] = useState<"line" | "bars">("line")
  const time = useBrowserTime()
  const summary = useMemo(() => {
    const total = points.reduce((sum, point) => sum + point.count, 0)
    const peak = points.reduce<TimeSeriesPoint | null>(
      (highest, point) =>
        !highest || point.count > highest.count ? point : highest,
      null
    )
    return {
      total,
      average: points.length ? Math.round(total / points.length) : 0,
      peak,
    }
  }, [points])
  const resolution = useMemo(() => {
    const fallback = range === "24h" ? 1800 : range === "7d" ? 3600 : 86_400
    const seconds =
      points.length > 1
        ? points[1]!.bucketEpoch - points[0]!.bucketEpoch
        : fallback
    if (seconds === 1800) return "30-minute completed intervals"
    if (seconds === 3600) return "Hourly completed intervals"
    const days = Math.max(1, Math.round(seconds / 86_400))
    return days === 1
      ? "Daily completed intervals"
      : `${days}-day grouped intervals`
  }, [points, range])
  const plotRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener("change", update)
    return () => preference.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const plot = plotRef.current
    if (!plot) return
    if (!("IntersectionObserver" in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(plot)
    return () => observer.disconnect()
  }, [points.length])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} · {resolution}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            value={[view]}
            onValueChange={(values) =>
              values[0] && setView(values[0] as "line" | "bars")
            }
            variant="outline"
            size="sm"
            spacing={0}
            aria-label={`${title} chart style`}
          >
            <ToggleGroupItem value="line" aria-label="Line and area chart">
              <ChartSplineIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Line</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="bars" aria-label="Bar chart">
              <ChartNoAxesColumnIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Bars</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2" aria-label={`${title} summary`}>
          <ChartSummary label="Total" value={summary.total} />
          <ChartSummary label="Average" value={summary.average} />
          <ChartSummary label="Peak" value={summary.peak?.count ?? 0} />
        </div>
        {points.length ? (
          <div ref={plotRef} className="h-[300px] min-w-0">
            <Suspense fallback={<ChartPlaceholder title={title} />}>
              {visible ? (
                <TimeSeriesPlot
                  title={title}
                  points={points}
                  range={range}
                  color={color}
                  view={view}
                  time={time}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <ChartPlaceholder title={title} />
              )}
            </Suspense>
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3Icon />
              </EmptyMedia>
              <EmptyTitle>No activity in this period</EmptyTitle>
              <EmptyDescription>
                Choose a longer reporting period to look for activity.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
})

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div
      className="flex h-full items-center justify-center rounded-lg bg-muted/20 text-sm text-muted-foreground"
      role="status"
      aria-label={`Loading ${title.toLowerCase()} chart`}
    >
      Loading chart…
    </div>
  )
}

function ChartSummary({
  label: name,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {name}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">
        {value.toLocaleString("en-US")}
      </p>
    </div>
  )
}
