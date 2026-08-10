"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { StatsRange, TimeSeriesPoint } from "@/lib/stats/types"

const chartConfig = {
  count: { label: "Count", color: "var(--chart-2)" },
} satisfies ChartConfig

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
  const data = points.map((point) => ({
    ...point,
    label: label(point.bucketEpoch, range),
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto min-h-64 w-full"
          aria-label={`${title}, UTC time series`}
        >
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 4, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line
              dataKey="count"
              type="monotone"
              stroke="var(--color-count)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
