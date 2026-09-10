// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { UserDownloadsTable } from "@/components/dashboard/user-downloads-table"
import type { PaginatedUserDownloads } from "@/lib/stats/types"

const downloads: PaginatedUserDownloads = {
  items: [
    {
      id: "2",
      downloadedAt: 2_000_000_000,
      sharedLink: "https://example.test/cached",
      mediaKind: "video",
      cacheHit: true,
      videoDetailsId: "1",
    },
    {
      id: "1",
      downloadedAt: 1_999_999_000,
      sharedLink: "https://example.test/downloaded",
      mediaKind: "video",
      cacheHit: false,
      videoDetailsId: "2",
    },
  ],
  page: 1,
  pageSize: 8,
  total: "2",
  totalPages: 1,
}

describe("user downloads table", () => {
  afterEach(cleanup)

  it("shows whether each download was a cache hit or miss", () => {
    render(
      <UserDownloadsTable
        data={downloads}
        loading={false}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByRole("columnheader", { name: "Cache" })).toBeTruthy()
    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[0]!).getByText("Hit")).toBeTruthy()
    expect(within(rows[1]!).getByText("Miss")).toBeTruthy()
  })

  it("offers previews for all downloads and other downloaders only for linked cache hits", () => {
    const onView = vi.fn()
    render(
      <UserDownloadsTable
        data={{
          ...downloads,
          items: [
            ...downloads.items,
            { ...downloads.items[0]!, id: "3", videoDetailsId: null },
          ],
        }}
        loading={false}
        onPageChange={vi.fn()}
        onView={onView}
      />
    )
    expect(screen.getAllByRole("button", { name: "View media" })).toHaveLength(
      3
    )
    const others = screen.getAllByRole("button", { name: "Other downloaders" })
    expect(others).toHaveLength(1)
    fireEvent.click(others[0]!)
    expect(onView).toHaveBeenCalledWith({
      id: "2",
      sharedLink: downloads.items[0]!.sharedLink,
      mode: "downloaders",
    })
    fireEvent.click(screen.getAllByRole("button", { name: "View media" })[1]!)
    expect(onView).toHaveBeenLastCalledWith({
      id: "1",
      sharedLink: downloads.items[1]!.sharedLink,
      mode: "media",
    })
  })

  it("prevents navigating before the first page and allows the next page", () => {
    const onPageChange = vi.fn()
    render(
      <UserDownloadsTable
        data={{ ...downloads, total: "16", totalPages: 2 }}
        loading={false}
        onPageChange={onPageChange}
      />
    )

    const previous = screen.getByRole("button", { name: "Go to previous page" })
    expect((previous as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(previous)
    expect(onPageChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("keeps existing rows visible and blocks repeated paging while refreshing", () => {
    const onPageChange = vi.fn()
    render(
      <UserDownloadsTable
        data={{ ...downloads, page: 2, total: "24", totalPages: 3 }}
        loading={false}
        refreshing
        onPageChange={onPageChange}
      />
    )

    expect(screen.getByRole("table", { name: "Download history" })).toBeTruthy()
    for (const name of ["Go to previous page", "Go to next page"]) {
      const button = screen.getByRole("button", { name })
      expect((button as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(button)
    }
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it("prevents navigating past the last page", () => {
    const onPageChange = vi.fn()
    render(
      <UserDownloadsTable
        data={{ ...downloads, page: 2, total: "16", totalPages: 2 }}
        loading={false}
        onPageChange={onPageChange}
      />
    )

    const next = screen.getByRole("button", { name: "Go to next page" })
    expect((next as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(next)
    expect(onPageChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Go to previous page" }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
