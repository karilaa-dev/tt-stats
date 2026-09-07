// @vitest-environment jsdom
import { act, type PropsWithChildren } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { useQuery } from "@tanstack/react-query"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
}))
vi.mock("@/components/dashboard/app-sidebar", () => ({
  AppSidebar: () => <nav>Navigation</nav>,
}))
vi.mock("@/components/dashboard/dashboard-header", () => ({
  DashboardHeader: () => <header>Dashboard</header>,
}))
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}))
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SidebarInset: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

it("hydrates an Astro dashboard island and loads its queries in the browser", async () => {
  const fetchStats = vi.fn(async () => "Loaded statistics")
  function Statistics() {
    const query = useQuery({ queryKey: ["hydration"], queryFn: fetchStats })
    return <section>{query.data ?? "Pending statistics"}</section>
  }
  const ui = (
    <DashboardShell pathname="/dashboard" search="" fakeMode>
      <Statistics />
    </DashboardShell>
  )
  const container = document.createElement("div")
  container.innerHTML = renderToString(ui)
  expect(container.textContent).toContain("Navigation")
  expect(container.textContent).toContain("Pending statistics")
  expect(fetchStats).not.toHaveBeenCalled()
  const recoverableError = vi.fn()
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(container, ui, { onRecoverableError: recoverableError })
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  expect(container.textContent).toContain("Loaded statistics")
  await act(async () => root.unmount())
  expect(recoverableError).not.toHaveBeenCalled()
})
