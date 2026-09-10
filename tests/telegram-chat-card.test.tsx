// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TelegramChatCard } from "@/components/dashboard/telegram-chat-card"
import type { TelegramChatProfile } from "@/lib/telegram/types"

const actions = vi.hoisted(() => ({ getTelegramChat: vi.fn() }))
vi.mock("@/lib/telegram/functions", () => actions)
const profile: TelegramChatProfile = {
  status: "available",
  id: "123",
  type: "private",
  name: "Alex Example",
  username: "alex_example",
}

function renderCard(id = "123") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = (chatId: string) => (
    <QueryClientProvider client={client}>
      <TelegramChatCard chatId={chatId} />
    </QueryClientProvider>
  )
  return { ...render(view(id)), view }
}

describe("Telegram chat details", () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(cleanup)

  it("shows the name, username link, type, and original ID", async () => {
    actions.getTelegramChat.mockResolvedValue(profile)
    renderCard()
    expect(await screen.findByText("Alex Example")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "@alex_example" }).getAttribute("href")
    ).toBe("https://t.me/alex_example")
    expect(screen.getByText("Private chat")).toBeTruthy()
    expect(screen.getByText("123")).toBeTruthy()
    expect(actions.getTelegramChat).toHaveBeenCalledWith("123")
  })

  it("clears the previous profile while a different ID loads", async () => {
    actions.getTelegramChat
      .mockResolvedValueOnce(profile)
      .mockImplementationOnce(() => new Promise(() => {}))
    const { rerender, view } = renderCard()
    await screen.findByText("Alex Example")
    rerender(view("-456"))
    expect(screen.queryByText("Alex Example")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByLabelText("Loading Telegram details")).toBeTruthy()
    expect(screen.getByText("-456")).toBeTruthy()
  })

  it("shows group titles without inventing a username", async () => {
    actions.getTelegramChat.mockResolvedValue({
      ...profile,
      type: "group",
      name: "Our group",
      username: null,
    })
    renderCard()
    expect(await screen.findByText("Our group")).toBeTruthy()
    expect(screen.getByText("No public username")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it.each([
    ["not_configured", "Configure BOT_TOKEN"],
    ["inaccessible", "Telegram could not find this chat"],
    ["unavailable", "Telegram details are temporarily unavailable"],
  ])("keeps the ID visible when %s", async (status, message) => {
    actions.getTelegramChat.mockResolvedValue({ status })
    renderCard()
    expect(await screen.findByText(new RegExp(message))).toBeTruthy()
    expect(screen.getByText("123")).toBeTruthy()
  })

  it("handles action failures without rendering error details", async () => {
    actions.getTelegramChat.mockRejectedValue(new Error("Internal detail"))
    renderCard()
    expect(
      await screen.findByText("Telegram details are temporarily unavailable.")
    ).toBeTruthy()
    expect(screen.queryByText("Internal detail")).toBeNull()
  })

  it("labels demo profiles and does not link to real Telegram accounts", async () => {
    actions.getTelegramChat.mockResolvedValue({ ...profile, demo: true })
    renderCard()
    expect(await screen.findByText("Demo data")).toBeTruthy()
    expect(screen.getByText("@alex_example")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
