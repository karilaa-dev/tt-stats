// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  CachePerformanceCard,
  StatsCards,
} from "@/components/dashboard/stats-cards"
import type { StatsBreakdown } from "@/lib/stats/types"

const stats: StatsBreakdown = {
  chats: "2",
  music: { total: "4", uniqueUsers: "2" },
  downloads: {
    total: "3",
    uniqueUsers: "2",
    images: "1",
    uniqueImageUsers: "1",
    cacheHits: "1",
  },
}

describe("statistics cards", () => {
  afterEach(cleanup)

  function cardFor(label: string): HTMLElement {
    const card = screen.getByText(label).closest('[data-slot="card"]')
    expect(card).toBeTruthy()
    return card as HTMLElement
  }

  it("shows cache hits and misses as separate cards with their rates", () => {
    render(<StatsCards stats={stats} />)

    const hitsCard = cardFor("Cache hits")
    expect(within(hitsCard).getByText("1")).toBeTruthy()
    expect(within(hitsCard).getByText("33.3% hit rate")).toBeTruthy()

    const missesCard = cardFor("Cache misses")
    expect(within(missesCard).getByText("2")).toBeTruthy()
    expect(within(missesCard).getByText("66.7% miss rate")).toBeTruthy()
  })

  it("shows only the cache hit percentage in overview mode", () => {
    render(<StatsCards stats={stats} cacheDisplay="percentage" />)

    const rateCard = cardFor("Cache hit rate")
    expect(rateCard.getAttribute("data-size")).toBe("default")
    expect(within(rateCard).getByText("33.3%")).toBeTruthy()
    expect(
      within(rateCard).getByText("Downloads served from cache")
    ).toBeTruthy()
    expect(screen.queryByText("Cache hits")).toBeNull()
    expect(screen.queryByText("Cache misses")).toBeNull()
  })

  it("shows cache hit and miss totals in the analytics card", () => {
    render(<CachePerformanceCard stats={stats} />)

    expect(
      within(cardFor("Cache performance")).getByText("Cache hits")
    ).toBeTruthy()
    expect(
      within(cardFor("Cache performance")).getByText("Cache misses")
    ).toBeTruthy()
    expect(
      within(cardFor("Cache performance")).getByText("33.3% of downloads")
    ).toBeTruthy()
    expect(
      within(cardFor("Cache performance")).getByText("66.7% of downloads")
    ).toBeTruthy()
  })

  it("shows zero rates when there are no downloads", () => {
    render(
      <StatsCards
        stats={{
          ...stats,
          downloads: { ...stats.downloads, total: "0", cacheHits: "0" },
        }}
      />
    )

    expect(
      within(cardFor("Cache hits")).getByText("0.0% hit rate")
    ).toBeTruthy()
    expect(
      within(cardFor("Cache misses")).getByText("0.0% miss rate")
    ).toBeTruthy()
  })

  it("formats cache counts without converting them to numbers", () => {
    render(
      <StatsCards
        stats={{
          ...stats,
          downloads: {
            ...stats.downloads,
            total: "9007199254740993",
            cacheHits: "1",
          },
        }}
      />
    )

    expect(
      within(cardFor("Cache misses")).getByText("9,007,199,254,740,992")
    ).toBeTruthy()
  })
})
