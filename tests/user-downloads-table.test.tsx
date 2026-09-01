// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react"
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
    },
    {
      id: "1",
      downloadedAt: 1_999_999_000,
      sharedLink: "https://example.test/downloaded",
      mediaKind: "video",
      cacheHit: false,
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
})
