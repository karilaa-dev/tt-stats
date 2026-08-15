import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runtime = vi.hoisted(() => ({
  check: vi.fn(async () => ({ status: "idle" as const })),
  clients: [] as Array<{
    connect: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
    query: ReturnType<typeof vi.fn>
  }>,
  connect: vi.fn<() => Promise<void>>(async () => undefined),
}))

vi.mock("nitro", () => ({
  definePlugin: (plugin: unknown) => plugin,
}))

vi.mock("pg", () => ({
  Client: class {
    connect = vi.fn(() => runtime.connect())
    end = vi.fn(async () => undefined)
    query = vi.fn(async () => ({ rows: [] }))

    constructor() {
      runtime.clients.push(this)
    }

    on() {
      return this
    }
  },
}))

vi.mock("@/lib/dev/fake-data", () => ({
  isFakeDataEnabled: () => false,
}))

vi.mock("@/lib/env", () => ({
  getDbEnv: () => ({ DB_URL: "postgresql://app:secret@database.test/ttbot" }),
  getVideoMonitorEnv: () => ({
    provider: "webhook" as const,
    url: "https://example.test/hook",
  }),
}))

vi.mock("@/lib/notifications/video-inactivity", () => ({
  checkVideoInactivity: runtime.check,
}))

import listenerPlugin from "@/server/plugins/video-inactivity-listener"

type CloseHook = () => void | Promise<void>

function startPlugin(): { close: CloseHook } {
  let close: CloseHook = () => undefined
  const plugin = listenerPlugin as unknown as (app: {
    hooks: { hook: (name: string, callback: CloseHook) => void }
  }) => void
  plugin({
    hooks: {
      hook(name, callback) {
        if (name === "close") close = callback
      },
    },
  })
  return { close: () => close() }
}

describe("video inactivity listener lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    runtime.clients.length = 0
    runtime.connect.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("checks on startup and every minute without a refresh notification", async () => {
    const { close } = startPlugin()
    expect(runtime.check).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(runtime.check).toHaveBeenCalledTimes(2)
    await close()
  })

  it("closes an in-flight connection before it can start listening", async () => {
    let finishConnect: (() => void) | undefined
    runtime.connect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishConnect = resolve
      })
    )

    const { close } = startPlugin()
    const client = runtime.clients[0]
    expect(client).toBeDefined()

    await close()
    expect(client?.end).toHaveBeenCalledOnce()

    finishConnect?.()
    await vi.runAllTimersAsync()
    expect(client?.query).not.toHaveBeenCalled()
  })
})
