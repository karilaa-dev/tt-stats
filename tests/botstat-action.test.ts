import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  start: vi.fn(),
}))

vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }))
vi.mock("@/lib/botstat/client", () => ({
  startBotstatVerification: mocks.start,
}))

import { botstatAction } from "@/app/botstat-action"

describe("Botstat server action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSession.mockResolvedValue(undefined)
  })

  it("requires a valid session before starting an upload", async () => {
    mocks.requireSession.mockRejectedValue(new Error("unauthorized"))
    await expect(botstatAction({ status: "idle", nonce: 0 })).rejects.toThrow(
      "unauthorized"
    )
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it("returns the task ID and maps infrastructure failures safely", async () => {
    mocks.start.mockResolvedValueOnce({ ok: true, taskId: "task-123" })
    await expect(botstatAction({ status: "idle", nonce: 0 })).resolves.toEqual({
      status: "success",
      message: "Botstat verification started.",
      taskId: "task-123",
      nonce: 1,
    })

    mocks.start.mockRejectedValueOnce(new Error("secret host details"))
    const failed = await botstatAction({ status: "idle", nonce: 1 })
    expect(failed).toEqual({
      status: "error",
      message: "Botstat verification is temporarily unavailable.",
      nonce: 2,
    })
  })
})
