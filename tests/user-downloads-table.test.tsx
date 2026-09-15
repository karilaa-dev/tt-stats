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
      videoId: null,
      canonicalUrl: null,
      viewsDisplay: null,
      likesDisplay: null,
      downloadedAt: 2_000_000_000,
      sharedLink: "https://example.test/cached",
      mediaKind: "video",
      cacheHit: true,
      videoDetailsId: "1",
      hasSavedMedia: true,
      otherUniqueChats: "0",
      isFirstDownloader: true,
    },
    {
      id: "1",
      videoId: null,
      canonicalUrl: null,
      viewsDisplay: null,
      likesDisplay: null,
      downloadedAt: 1_999_999_000,
      sharedLink: "https://example.test/downloaded",
      mediaKind: "video",
      cacheHit: false,
      videoDetailsId: "2",
      hasSavedMedia: true,
      otherUniqueChats: "5",
      isFirstDownloader: false,
    },
  ],
  page: 1,
  pageSize: 8,
  total: "2",
  totalPages: 1,
}

describe("user downloads table", () => {
  afterEach(cleanup)

  it("shows first-downloader status independently of cache and other-chat counts", () => {
    render(
      <UserDownloadsTable
        data={downloads}
        own
        loading={false}
        onPageChange={vi.fn()}
      />
    )

    const rows = screen.getAllByRole("listitem")
    expect(within(rows[0]!).getByText("You were first")).toBeTruthy()
    expect(
      within(rows[0]!).queryByText("No other people have downloaded this yet")
    ).toBeNull()
    expect(
      within(rows[1]!).getByText("5 other people downloaded this")
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Other downloaders" })
    ).toBeNull()
  })

  it("offers admins previews and downloader identities for linked posts regardless of cache hits", () => {
    const onView = vi.fn()
    render(
      <UserDownloadsTable
        data={{
          ...downloads,
          items: [
            ...downloads.items,
            {
              ...downloads.items[0]!,
              id: "3",
              videoDetailsId: null,
              hasSavedMedia: false,
            },
            { ...downloads.items[0]!, id: "4", hasSavedMedia: false },
          ],
        }}
        loading={false}
        onPageChange={vi.fn()}
        onView={onView}
        admin
      />
    )
    expect(screen.getAllByRole("button", { name: "View media" })).toHaveLength(
      2
    )
    const others = screen.getAllByRole("button", { name: "Other downloaders" })
    expect(others).toHaveLength(3)
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

    expect(screen.getByRole("list", { name: "Download history" })).toBeTruthy()
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

for (const category of ["history", "popular"] as const)
  for (const admin of [false, true]) {
    it(`shows canonical identities and stored engagement for ${category}, admin=${admin}`, () => {
      const post = "https://www.tiktok.com/@alice/video/7539876543210000001"
      const items = [
        {
          ...downloads.items[0]!,
          videoId: "7539876543210000001",
          canonicalUrl: post,
          sharedLink: "https://vm.tiktok.com/ABC/",
          viewsDisplay: "1.2M",
          likesDisplay: "0",
        },
        {
          ...downloads.items[1]!,
          videoId: "7539876543210000001",
          canonicalUrl: post,
          sharedLink: post + "?tracking=1",
          viewsDisplay: " ",
          likesDisplay: "25",
        },
        {
          ...downloads.items[0]!,
          id: "3",
          viewsDisplay: "0",
          likesDisplay: null,
        },
        {
          ...downloads.items[1]!,
          id: "4",
          viewsDisplay: null,
          likesDisplay: " ",
        },
      ]
      render(
        <UserDownloadsTable
          data={{ ...downloads, items }}
          category={category}
          admin={admin}
          loading={false}
          onPageChange={vi.fn()}
        />
      )
      const rows = screen.getAllByRole("listitem")
      const first = within(rows[0]!)
      expect(
        first
          .getByRole("link", { name: new RegExp(items[0]!.videoId!) })
          .getAttribute("href")
      ).toBe(post)
      expect(
        first
          .getByRole("link", { name: new RegExp(items[0]!.videoId!) })
          .getAttribute("target")
      ).toBe("_blank")
      expect(first.getByText("1.2M")).toBeTruthy()
      expect(first.getByText("0")).toBeTruthy()
      expect(first.getByText("Views")).toBeTruthy()
      expect(first.getByText("Likes")).toBeTruthy()
      expect(rows[1]!.textContent).not.toContain("Views")
      expect(within(rows[1]!).getAllByRole("link")).toHaveLength(1)
      expect(rows[2]!.textContent).not.toContain("Likes")
      expect(rows[3]!.textContent).not.toContain("Views")
      expect(rows[3]!.textContent).not.toContain("Likes")
      expect(within(rows[3]!).getByRole("link").getAttribute("href")).toBe(
        downloads.items[1]!.sharedLink
      )
      cleanup()
    })
  }
