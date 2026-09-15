import { T, useTranslation } from "@/lib/i18n/provider"
import {
  lazy,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
} from "@/components/controls"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/controls"
import { ToggleGroup, ToggleGroupItem } from "@/components/controls"
import { useBrowserTime } from "@/lib/browser-time"
import type { StatsRange, TimeSeriesPoint } from "@/lib/stats/types"

const TimeSeriesPlot = lazy(() => import("./time-series-plot"))

export const TimeSeriesChart = memo(function TimeSeriesChart({
  title,
  description,
  points,
  range,
  color = "var(--chart-1)",
  intervalDescription,
  controls,
  compact = false,
  calendarUnit,
  loading = false,
  error,
}: {
  title: string
  description: string
  points: TimeSeriesPoint[]
  range: StatsRange
  color?: string
  intervalDescription?: string
  controls?: ReactNode
  compact?: boolean
  calendarUnit?: "day" | "week" | "month"
  loading?: boolean
  error?: ReactNode
}) {
  const { t } = useTranslation()

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
    if (intervalDescription) return intervalDescription
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
  }, [points, range, intervalDescription])
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
  }, [points.length, loading, error])

  return (
    <Card
      className={compact ? "profile-activity-card" : undefined}
      aria-busy={loading}
    >
      <CardHeader>
        <CardTitle>
          <T>{title}</T>
        </CardTitle>
        <CardDescription>
          <T>{description}</T> · <T>{resolution}</T>
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
            aria-label={t(`${title} chart style`)}
          >
            <ToggleGroupItem value="line" aria-label={t("Line and area chart")}>
              <ChartSplineIcon data-icon="inline-start" />
              <span className="hidden sm:inline">
                <T>{"Line"}</T>
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="bars" aria-label={t("Bar chart")}>
              <ChartNoAxesColumnIcon data-icon="inline-start" />
              <span className="hidden sm:inline">
                <T>{"Bars"}</T>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <T>{controls}</T>
        <div
          className="grid grid-cols-3 gap-2"
          aria-label={t(`${title} summary`)}
        >
          <ChartSummary
            label="Total"
            value={summary.total}
            loading={loading || Boolean(error)}
          />
          <ChartSummary
            label="Average"
            value={summary.average}
            loading={loading || Boolean(error)}
          />
          <ChartSummary
            label="Peak"
            value={summary.peak?.count ?? 0}
            loading={loading || Boolean(error)}
          />
        </div>
        <T>
          {loading || error ? (
            <div
              style={{ height: compact ? 200 : 300, overflow: "auto" }}
              aria-label={t("Loading download activity")}
            >
              <T>{error || <ChartPlaceholder title={t(title)} />}</T>
            </div>
          ) : points.length ? (
            <div
              ref={plotRef}
              className="min-w-0"
              style={{ height: compact ? 200 : 300 }}
            >
              <Suspense fallback={<ChartPlaceholder title={t(title)} />}>
                <T>
                  {visible ? (
                    <TimeSeriesPlot
                      title={t(title)}
                      points={points}
                      range={range}
                      color={color}
                      view={view}
                      time={time}
                      reducedMotion={reducedMotion}
                      height={compact ? 200 : 300}
                      calendarUnit={calendarUnit}
                    />
                  ) : (
                    <ChartPlaceholder title={t(title)} />
                  )}
                </T>
              </Suspense>
            </div>
          ) : (
            <Empty style={{ height: compact ? 200 : 300 }}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BarChart3Icon />
                </EmptyMedia>
                <EmptyTitle>
                  <T>{"No activity in this period"}</T>
                </EmptyTitle>
                <EmptyDescription>
                  <T>
                    {"Choose a longer reporting period to look for activity."}
                  </T>
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </T>
      </CardContent>
    </Card>
  )
})

function ChartPlaceholder({ title }: { title: string }) {
  const { t } = useTranslation()

  return (
    <div
      className="flex h-full items-center justify-center rounded-lg bg-muted/20 text-sm text-muted-foreground"
      role="status"
      aria-label={t(`Loading ${title.toLowerCase()} chart`)}
    >
      <T>{"Loading chart…"}</T>
    </div>
  )
}

function ChartSummary({
  label: name,
  value,
  loading = false,
}: {
  label: string
  loading?: boolean
  value: number
}) {
  const { locale } = useTranslation()

  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        <T>{name}</T>
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">
        <T>{loading ? "—" : value.toLocaleString(locale)}</T>
      </p>
    </div>
  )
}
