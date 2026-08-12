// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DatabaseSetupCard } from "@/components/dashboard/database-setup-card"
import type { DatabaseSetupStatus } from "@/lib/stats/setup-types"

vi.mock("@/lib/stats/functions", () => ({
  configureDatabaseJobs: vi.fn(),
}))

const missingSetup: DatabaseSetupStatus = {
  appConnection: { ok: true, errorKind: null },
  databaseRole: { canCreate: true, superuser: true },
  snapshot: {
    schemaInstalled: false,
    tablesInstalled: false,
    jobsApiInstalled: false,
    appCanRead: false,
    appCanManageJobs: false,
    rollingSeeded: false,
    dailySeeded: false,
  },
  scheduler: {
    pgCronInstalled: false,
    pgCronVersion: null,
    inspectable: false,
    rollingJobInstalled: false,
    dailyJobInstalled: false,
  },
  ready: false,
}

function renderSetup(status: DatabaseSetupStatus) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DatabaseSetupCard status={status} />
    </QueryClientProvider>
  )
}

describe("database setup diagnostics", () => {
  afterEach(cleanup)

  it("requires confirmation before using DB_URL for database setup", () => {
    renderSetup(missingSetup)

    expect(screen.getByText("Database connection verified")).toBeTruthy()
    expect(screen.getByText("DB_URL connected successfully.")).toBeTruthy()
    expect(
      screen.getByText("One or more TT Stats database objects are missing.")
    ).toBeTruthy()
    const setupButton = screen.getByRole("button", {
      name: "Install or repair database jobs",
    }) as HTMLButtonElement
    expect(setupButton.disabled).toBe(true)

    fireEvent.click(
      screen.getByRole("switch", {
        name: "DB_URL has administrative privileges",
      })
    )

    expect(setupButton.disabled).toBe(false)
  })

  it("keeps setup disabled and marks dependent checks as pending offline", () => {
    renderSetup({
      ...missingSetup,
      appConnection: { ok: false, errorKind: "connection" },
    })

    expect(
      screen.getByText("Not checked until the application connection succeeds.")
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: "Install or repair database jobs",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      screen
        .getByRole("switch", {
          name: "DB_URL has administrative privileges",
        })
        .hasAttribute("data-disabled")
    ).toBe(true)
  })
})
