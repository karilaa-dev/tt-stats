// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DATABASE_ERROR_COPY, isSafeDatabaseError } from "@/lib/db/errors"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...props }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...props} />
  ),
}))

describe("dashboard infrastructure failures", () => {
  afterEach(cleanup)

  it("renders an accessible generic alert without leaking exception details", () => {
    const reset = vi.fn()
    render(
      <DashboardError
        error={new Error("postgresql://secret@database.internal/ttbot")}
        reset={reset}
      />
    )

    expect(screen.getByRole("alert").textContent).toContain(
      "Statistics could not be loaded"
    )
    expect(screen.queryByText(/database\.internal/u)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it("shows a specific safe message for a recognized database failure", () => {
    const safeError = new Error(DATABASE_ERROR_COPY.snapshotSchema.description)
    expect(isSafeDatabaseError(safeError)).toBe(true)
    expect(isSafeDatabaseError(new Error("postgresql://secret@host/db"))).toBe(
      false
    )
    render(<DashboardError error={safeError} reset={vi.fn()} />)

    expect(
      screen.getByText("TT Stats database objects are not installed")
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Open Database jobs" })
        .getAttribute("href")
    ).toBe("/dashboard/jobs")
  })
})
