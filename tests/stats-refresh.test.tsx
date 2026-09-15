// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { act } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
const mocks = vi.hoisted(() => ({ request: vi.fn(), status: vi.fn() }))
vi.mock("@/lib/stats/functions", () => ({
  requestStatsJobRun: mocks.request,
  getManualRefreshRequest: mocks.status,
}))
vi.mock("@/lib/stats/query-options", () => ({
  statsQueryKey: ["stats"],
  statsJobsQueryOptions: () => ({
    queryKey: ["stats", "jobs"],
    queryFn: async () =>
      ["rolling_24h", "daily"].map((dataset) => ({
        dataset,
        schedule: "* * * * *",
        pendingRequest: null,
      })),
  }),
}))
import { StatsRefresh } from "@/components/dashboard/stats-refresh"
import { snapshotViewMatches } from "@/lib/stats/snapshot-refresh"
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
for (const dataset of ["rolling_24h", "daily"] as const)
  for (const finalStatus of ["succeeded", "failed"] as const)
    it(`queues and tracks a real ${dataset} rebuild with ${finalStatus} after menu close`, async () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
      mocks.request.mockResolvedValue({ requestId: "42" })
      mocks.status.mockResolvedValue({
        id: "42",
        dataset,
        status: "queued",
        requestedAt: 1,
        startedAt: null,
        finishedAt: null,
      })
      const invalidations = vi.spyOn(client, "invalidateQueries")
      render(
        <QueryClientProvider client={client}>
          <StatsRefresh fakeMode={false} />
        </QueryClientProvider>
      )
      fireEvent.click(screen.getByRole("button", { name: "Update now" }))
      const title =
        dataset === "daily" ? "Daily statistics" : "Recent statistics"
      const item = await screen.findByRole("menuitem", { name: title })
      await waitFor(() =>
        expect(item.getAttribute("aria-disabled")).not.toBe("true")
      )
      fireEvent.click(item)
      await waitFor(() =>
        expect(mocks.request).toHaveBeenCalledWith({ data: { dataset } })
      )
      await waitFor(() => expect(item.textContent).toContain("Queued"))
      fireEvent.click(item)
      expect(mocks.request).toHaveBeenCalledTimes(1)
      fireEvent.keyDown(item, { key: "Escape" })
      await act(async () => {
        client.setQueryData(["stats", "jobs", "manual", "42"], {
          id: "42",
          dataset,
          status: finalStatus,
          requestedAt: 1,
          finishedAt: 2,
        })
      })
      await waitFor(() =>
        expect(
          invalidations.mock.calls.some(
            ([arg]) => arg?.queryKey?.[1] === "metadata"
          )
        ).toBe(finalStatus === "succeeded")
      )
      const predicate = invalidations.mock.calls.find(
        ([arg]) => arg?.predicate
      )?.[0]?.predicate
      expect(Boolean(predicate)).toBe(finalStatus === "succeeded")
      client.clear()
    })
it("invalidates only snapshots backed by the completed dataset", () => {
  expect(
    snapshotViewMatches(["stats", "breakdown", "users", "24h"], "daily")
  ).toBe(false)
  expect(
    snapshotViewMatches(["stats", "popular-videos", "31d", 1], "daily")
  ).toBe(true)
  expect(snapshotViewMatches(["stats", "overview"], "rolling_24h")).toBe(true)
  expect(snapshotViewMatches(["stats", "user", "123"], "daily")).toBe(false)
  expect(snapshotViewMatches(["stats", "jobs"], "daily")).toBe(false)
})
