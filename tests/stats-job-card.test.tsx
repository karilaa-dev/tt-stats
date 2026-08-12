// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StatsJobCard } from "@/components/dashboard/stats-job-card"
import type { StatsJob } from "@/lib/stats/types"

const actions = vi.hoisted(() => ({
  getManualRefreshRequest: vi.fn(async () => null),
  requestStatsJobRun: vi.fn(async () => ({ requestId: "42" })),
  setStatsJobActive: vi.fn(async ({ data }: { data: { active: boolean } }) => ({
    active: data.active,
  })),
  updateStatsJobSchedule: vi.fn(
    async ({ data }: { data: { schedule: string } }) => ({
      schedule: data.schedule,
    })
  ),
}))

vi.mock("@/lib/stats/functions", () => actions)
vi.mock("@/lib/stats/query-options", () => ({
  statsQueryKey: ["stats"],
  statsJobRunsQueryOptions: (dataset: string) => ({
    queryKey: ["stats", "jobs", dataset, "runs"],
    queryFn: async () => [],
  }),
}))

function job(dataset: StatsJob["dataset"]): StatsJob {
  return {
    dataset,
    jobName: dataset === "daily" ? "tt-stats-daily" : "tt-stats-rolling-24h",
    schedule: dataset === "daily" ? "7 0 * * *" : "*/5 * * * *",
    active: true,
    lastStatus: "succeeded",
    lastStartedAt: 2_000_000,
    lastFinishedAt: 2_000_004,
    lastDurationMs: 4_000,
    snapshot: {
      dataset,
      refreshedAt: 2_000_004,
      windowStartEpoch: 1_900_000,
      windowEndEpoch: 2_000_000,
    },
    pendingRequest: null,
  }
}

function renderJob(dataset: StatsJob["dataset"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <StatsJobCard job={job(dataset)} />
    </QueryClientProvider>
  )
}

describe("database job controls", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it("confirms pausing and cron expression changes", () => {
    renderJob("rolling_24h")
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(
      screen.getByRole("alertdialog", { name: "Pause this database job?" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    fireEvent.change(screen.getByLabelText("Cron schedule"), {
      target: { value: "*/10 * * * *" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      screen.getByRole("alertdialog", { name: "Change the cron schedule?" })
    ).toBeTruthy()
  })

  it("requires confirmation for a daily manual refresh", () => {
    renderJob("daily")
    fireEvent.click(screen.getByRole("button", { name: "Run now" }))
    expect(
      screen.getByRole("alertdialog", { name: "Queue the daily refresh?" })
    ).toBeTruthy()
  })

  it("rejects empty, control-character, and oversized schedules in the UI", () => {
    renderJob("rolling_24h")
    const input = screen.getByLabelText("Cron schedule")

    fireEvent.change(input, { target: { value: "" } })
    expect(screen.getByText("Enter a cron schedule.")).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)

    fireEvent.change(input, { target: { value: "* *\t* * *" } })
    expect(
      screen.getByText("Cron schedules cannot contain control characters.")
    ).toBeTruthy()

    fireEvent.change(input, { target: { value: "x".repeat(101) } })
    expect(
      screen.getByText("Cron schedules cannot exceed 100 characters.")
    ).toBeTruthy()
  })
})
