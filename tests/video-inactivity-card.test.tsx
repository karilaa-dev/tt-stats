// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { VideoInactivityCard } from "@/components/dashboard/video-inactivity-card"

const actions = vi.hoisted(() => ({
  sendVideoNotificationTest: vi.fn(async () => ({
    ok: true as const,
    message: "Test notification sent through ntfy.",
  })),
}))

vi.mock("@/lib/notifications/functions", () => actions)

function renderCard(configured: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <VideoInactivityCard
        status={{
          configured,
          provider: configured ? "ntfy" : null,
          configurationError: false,
        }}
        monitorReady
      />
    </QueryClientProvider>
  )
}

describe("video inactivity notification card", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it("sends a real test without requiring an inactivity event", async () => {
    renderCard(true)
    fireEvent.click(
      screen.getByRole("button", { name: "Send test notification" })
    )
    await waitFor(() =>
      expect(actions.sendVideoNotificationTest).toHaveBeenCalledOnce()
    )
  })

  it("disables the test button until a destination is configured", () => {
    renderCard(false)
    expect(
      (
        screen.getByRole("button", {
          name: "Send test notification",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
