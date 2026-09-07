// @vitest-environment jsdom

import { act, type ComponentType, type PropsWithChildren } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, it, vi } from "vitest"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
const state = vi.hoisted(() => ({ resolved: false }))
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => ({ fakeMode: false }),
  }),
  Outlet: () =>
    state.resolved ? (
      <section>Loaded statistics</section>
    ) : (
      <div>Pending statistics</div>
    ),
}))
vi.mock("@/lib/stats/functions", () => ({ getDashboardMeta: vi.fn() }))
vi.mock("@/components/dashboard/app-sidebar", () => ({
  AppSidebar: () => <nav>Navigation</nav>,
}))
vi.mock("@/components/dashboard/dashboard-header", () => ({
  DashboardHeader: () => <header>Dashboard</header>,
}))
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SidebarInset: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))

import { Route } from "@/src/routes/dashboard"

it("hydrates the dashboard when streamed query data settles before hydration", async () => {
  const Layout = Route.options.component as ComponentType
  const container = document.createElement("div")
  state.resolved = false
  container.innerHTML = renderToString(<Layout />)
  expect(container.textContent).toContain("Navigation")
  state.resolved = true
  const recoverableError = vi.fn()
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <Layout />, {
      onRecoverableError: recoverableError,
    })
  })
  expect(container.textContent).toContain("Loaded statistics")
  await act(async () => {
    root?.unmount()
  })
  expect(recoverableError).not.toHaveBeenCalled()
})
