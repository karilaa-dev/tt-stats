// @vitest-environment jsdom

import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, it, vi } from "vitest"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const state = vi.hoisted(() => ({ fetching: 1 }))
vi.mock("@tanstack/react-query", () => ({
  useIsFetching: () => state.fetching,
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ refetchQueries: vi.fn() }),
}))
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouterState: () => "/dashboard",
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn() }) }))
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button>Sidebar</button>,
}))
vi.mock("@/lib/stats/query-options", () => ({
  snapshotMetadataQueryOptions: () => ({}),
  statsQueryKey: ["stats"],
}))

import { DashboardHeader } from "@/components/dashboard/dashboard-header"

it("hydrates when the server has pending queries but the browser does not", async () => {
  const container = document.createElement("div")
  state.fetching = 1
  container.innerHTML = renderToString(<DashboardHeader />)
  state.fetching = 0
  const recoverableError = vi.fn()
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <DashboardHeader />, {
      onRecoverableError: recoverableError,
    })
  })
  state.fetching = 1
  await act(async () => {
    root?.render(<DashboardHeader />)
  })
  expect(container.textContent).toContain("Refreshing in background")
  await act(async () => {
    root?.unmount()
  })
  expect(recoverableError).not.toHaveBeenCalled()
})
