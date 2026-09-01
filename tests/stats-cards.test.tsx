// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { StatsCards } from "@/components/dashboard/stats-cards"
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

  it("shows cache hits, misses, and the hit rate", () => {
    render(<StatsCards stats={stats} />)

    const label = screen.getByText("Cache hits")
    const card = label.closest('[data-slot="card"]')
    expect(card).toBeTruthy()
    expect(within(card as HTMLElement).getByText("1")).toBeTruthy()
    expect(
      within(card as HTMLElement).getByText("2 misses · 33.3% hit rate")
    ).toBeTruthy()
  })
})
