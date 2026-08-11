import { useMemo } from "react"
import { Chart } from "@tanstack/charts/react"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { defineChart, lineY } from "@tanstack/charts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
}: {
  title: string
  description: string
  points: TimeSeriesPoint[]
  range: StatsRange
}) {
  const definition = useMemo(() => {
    const data = points.map((point) => ({
      ...point,
      label: label(point.bucketEpoch, range),
    }))

    return defineChart({
      marks: [
        lineY(data, {
          x: "label",
          y: "count",
          stroke: "var(--chart-2)",
          strokeWidth: 2,
          points: false,
        }),
      ],
      x: {
        scale: () => scaleBand<string>().padding(0.1),
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
      tooltip,
      svgAnimation: true,
    })
  }, [points, range])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Chart
          definition={definition}
          height={256}
          ariaLabel={`${title}, UTC time series`}
        />
      </CardContent>
    </Card>
  )
}
