// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DATABASE_ERROR_COPY, isSafeDatabaseError } from "@/lib/db/errors"

const access = vi.hoisted(() => ({ authenticated: false }))
vi.mock("@/components/dashboard/admin-access", () => ({
  useAdminAccess: () => access,
}))
describe("dashboard infrastructure failures", () => {
  afterEach(() => {
    cleanup()
    access.authenticated = false
  })

  it("renders an accessible generic alert without leaking exception details", () => {
    const reset = vi.fn()
    render(
      <DashboardError
        error={new Error("postgresql://secret@database.internal/ttbot")}
        reset={reset}
      />
    )

    expect(screen.getByRole("alert").textContent).toContain(
      "Statistics are unavailable"
    )
    expect(screen.queryByText(/database\.internal/u)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it("shows a specific safe message for a recognized database failure", () => {
    access.authenticated = true
    const safeError = new Error(DATABASE_ERROR_COPY.snapshotSchema.description)
    expect(isSafeDatabaseError(safeError)).toBe(true)
    expect(isSafeDatabaseError(new Error("postgresql://secret@host/db"))).toBe(
      false
    )
    render(<DashboardError error={safeError} reset={vi.fn()} />)

    expect(
      screen.getByText("@ttgrab Stats database objects need repair")
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Open Database jobs" })
        .getAttribute("href")
    ).toBe("/dashboard/jobs")
  })
})
