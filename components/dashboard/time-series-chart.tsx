import { useMemo, useState } from "react"
import { Chart } from "@tanstack/charts/react"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { areaY, barY, crosshair, defineChart, lineY } from "@tanstack/charts"
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
import type { StatsRange, TimeSeriesPoint } from "@/lib/stats/types"

function label(epoch: number, range: StatsRange) {
  return new Date(epoch * 1000).toLocaleString("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    ...(range === "24h" || range === "7d"
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
  })
}

export function TimeSeriesChart({
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
  const data = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        label: label(point.bucketEpoch, range),
      })),
    [points, range]
  )
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
  const definition = useMemo(() => {
    const marks =
      view === "bars"
        ? [
            barY(data, {
              id: "interval-counts",
              x: "label",
              y: "count",
              fill: color,
              fillOpacity: 0.82,
              inset: 1,
              radius: 3,
            }),
          ]
        : [
            areaY(data, {
              id: "interval-area",
              x: "label",
              y: "count",
              fill: color,
              fillOpacity: 0.12,
            }),
            lineY(data, {
              id: "interval-line",
              x: "label",
              y: "count",
              stroke: color,
              strokeWidth: 2.5,
              points: true,
            }),
          ]

    return defineChart({
      marks: [
        ...marks,
        crosshair<string, number>({
          x: {
            stroke: "var(--muted-foreground)",
            strokeOpacity: 0.4,
            strokeDasharray: "4 4",
          },
          y: false,
          marker: {
            radius: 4,
            fill: "var(--background)",
            stroke: color,
            strokeWidth: 2,
          },
        }),
      ],
      x: {
        scale: () => scaleBand<string>().padding(view === "bars" ? 0.16 : 0.08),
        axis: {
          ticks: { spacing: 72 },
          tickLabels: { thin: { minGap: 12, priority: "ends" } },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          label: "Count",
          ticks: { format: (value) => value.toLocaleString("en-US") },
        },
      },
      focus: "nearest-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        sticky: true,
        placement: ["top", "right", "left", "bottom"],
        items: [
          { field: "label", label: "UTC interval" },
          {
            channel: "y",
            label: title,
            text: (point) => Number(point.yValue).toLocaleString("en-US"),
          },
        ],
      },
      svgAnimation: true,
    })
  }, [color, data, title, view])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
          <Chart
            definition={definition}
            height={300}
            ariaLabel={`${title}, UTC time series`}
            ariaDescription="Use the pointer or arrow keys to inspect intervals. Click or press Enter to pin a value."
          />
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
