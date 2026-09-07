// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RankedTable } from "@/components/dashboard/ranked-table"

const rows = [
  { value: "first", count: "9007199254740993" },
  { value: "second", count: "4" },
  { value: "third", count: "2" },
]

describe("ranked table", () => {
  afterEach(cleanup)

  it("keeps a valid page when filtering reduces the result count", () => {
    const { rerender } = render(
      <RankedTable rows={rows} valueLabel="User" page={2} pageSize={2} />
    )
    expect(screen.getByText("third")).toBeTruthy()
    rerender(
      <RankedTable
        rows={rows.slice(0, 1)}
        valueLabel="User"
        page={2}
        pageSize={2}
      />
    )
    expect(screen.getByText("first")).toBeTruthy()
    expect(screen.getByText("9,007,199,254,740,993")).toBeTruthy()
  })

  it("prevents disabled pagination actions and allows advancing", () => {
    const onPageChange = vi.fn()
    render(
      <RankedTable
        rows={rows}
        valueLabel="User"
        pageSize={2}
        onPageChange={onPageChange}
      />
    )
    const previous = screen.getByRole("button", { name: "Go to previous page" })
    expect(previous.getAttribute("tabindex")).toBe("-1")
    fireEvent.click(previous)
    expect(onPageChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("explains how to find activity when there are no results", () => {
    render(<RankedTable rows={[]} valueLabel="User" />)
    expect(screen.getByText("No results for this period")).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
