import { memo, useMemo } from "react"
import { Chart } from "@tanstack/charts/react"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { areaY, barY, crosshair, defineChart, lineY } from "@tanstack/charts"
import type { BrowserTimeSettings } from "@/lib/browser-time"
import type { StatsRange, TimeSeriesPoint } from "@/lib/stats/types"

export interface TimeSeriesPlotProps {
  title: string
  points: TimeSeriesPoint[]
  range: StatsRange
  color: string
  view: "line" | "bars"
  time: BrowserTimeSettings
  reducedMotion: boolean
}

export default memo(function TimeSeriesPlot({
  title,
  points,
  range,
  color,
  view,
  time,
  reducedMotion,
}: TimeSeriesPlotProps) {
  // Reuse formatters across every point and axis tick in this reporting period.
  const { labelFormatter, tickFormatter } = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: time.timeZone,
      month: "short",
      day: "2-digit",
      ...(range === "all" ? { year: "numeric" as const } : {}),
      ...(range === "24h" || range === "7d"
        ? { hour: "2-digit" as const, minute: "2-digit" as const }
        : {}),
    }
    return {
      labelFormatter: new Intl.DateTimeFormat(time.locale, {
        ...options,
        timeZoneName: "short",
      }),
      tickFormatter: new Intl.DateTimeFormat(time.locale, options),
    }
  }, [range, time.locale, time.timeZone])
  const data = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        label: labelFormatter.format(point.bucketEpoch * 1000),
      })),
    [points, labelFormatter]
  )
  const definition = useMemo(() => {
    const marks =
      view === "bars"
        ? [
            barY(data, {
              id: "interval-counts",
              x: "bucketEpoch",
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
              x: "bucketEpoch",
              y: "count",
              fill: color,
              fillOpacity: 0.12,
            }),
            lineY(data, {
              id: "interval-line",
              x: "bucketEpoch",
              y: "count",
              stroke: color,
              strokeWidth: 2.5,
              points: data.length <= 200,
            }),
          ]

    return defineChart({
      marks: [
        ...marks,
        crosshair<number, number>({
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
        scale: () => scaleBand<number>().padding(view === "bars" ? 0.16 : 0.08),
        axis: {
          ticks: {
            spacing: 72,
            format: (value) => tickFormatter.format(value * 1000),
          },
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
          { field: "label", label: "Local interval" },
          {
            channel: "y",
            label: title,
            text: (point) => Number(point.yValue).toLocaleString("en-US"),
          },
        ],
      },
      svgAnimation: !reducedMotion && data.length <= 240,
    })
  }, [color, data, reducedMotion, tickFormatter, title, view])

  return (
    <Chart
      definition={definition}
      height={300}
      ariaLabel={`${title}, ${time.timeZone} time series`}
      ariaDescription="Use the pointer or arrow keys to inspect intervals. Click or press Enter to pin a value."
    />
  )
})
