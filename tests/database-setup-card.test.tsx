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
  databaseRole: {
    canCreate: true,
    canCreateTemporaryTables: true,
    canReadSourceTables: true,
    canUseCron: true,
    superuser: false,
  },
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
    pgCronInstalled: true,
    pgCronVersion: "1.6",
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

  it("allows a limited non-superuser role after confirmation", () => {
    renderSetup(missingSetup)

    expect(screen.getByText("Database connection verified")).toBeTruthy()
    expect(screen.getByText("DB_URL connected successfully.")).toBeTruthy()
    expect(
      screen.getByText("One or more TT Stats database objects are missing.")
    ).toBeTruthy()
    expect(
      screen.getByText(
        "All required database-scoped grants exist. This role is not a superuser."
      )
    ).toBeTruthy()
    expect(
      screen.getByText("One-time administrator guide for PostgreSQL 17")
    ).toBeTruthy()
    const setupButton = screen.getByRole("button", {
      name: "Install or repair database jobs",
    }) as HTMLButtonElement
    expect(setupButton.disabled).toBe(true)

    fireEvent.click(
      screen.getByRole("switch", {
        name: "DB_URL has the listed non-superuser grants",
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
          name: "DB_URL has the listed non-superuser grants",
        })
        .hasAttribute("data-disabled")
    ).toBe(true)
  })

  it("keeps app setup disabled until an administrator installs pg_cron", () => {
    renderSetup({
      ...missingSetup,
      databaseRole: { ...missingSetup.databaseRole, canUseCron: false },
      scheduler: {
        ...missingSetup.scheduler,
        pgCronInstalled: false,
        pgCronVersion: null,
      },
    })

    expect(screen.getByText("pg_cron is not enabled")).toBeTruthy()
    expect(
      screen.getByText(
        "Setup is disabled until a PostgreSQL administrator enables pg_cron using the guide above."
      )
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: "Install or repair database jobs",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("blocks guided setup when DB_URL is a PostgreSQL superuser", () => {
    renderSetup({
      ...missingSetup,
      databaseRole: { ...missingSetup.databaseRole, superuser: true },
    })

    expect(screen.getByText("DB_URL is too privileged")).toBeTruthy()
    expect(
      screen.getByText(
        "Setup is disabled while DB_URL uses a PostgreSQL superuser."
      )
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: "Install or repair database jobs",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
