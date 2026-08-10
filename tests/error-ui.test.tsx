// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import DashboardError from "@/app/(dashboard)/dashboard/error"

describe("dashboard infrastructure failures", () => {
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
})
