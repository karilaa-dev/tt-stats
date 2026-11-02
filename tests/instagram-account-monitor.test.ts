import { afterEach, beforeEach, expect, it, vi } from "vitest"
const { check, configuration, fake } = vi.hoisted(() => ({
  check: vi.fn(),
  configuration: vi.fn(),
  fake: vi.fn(),
}))
vi.mock("@/lib/notifications/instagram-dead", () => ({
  checkDeadInstagramAccounts: check,
}))
vi.mock("@/lib/env", () => ({ getInstagramMonitorEnv: configuration }))
vi.mock("@/lib/dev/fake-data", () => ({ isFakeDataEnabled: fake }))
import { startInstagramAccountMonitor } from "@/server/plugins/instagram-account-monitor"
beforeEach(() => {
  vi.useFakeTimers()
  fake.mockReturnValue(false)
  configuration.mockReturnValue({
    provider: "ntfy",
    url: "https://ntfy.example/test",
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})
it("checks without a page visit, prevents overlapping checks and drains on shutdown", async () => {
  let resolve!: (value: string) => void
  check.mockImplementation(
    () =>
      new Promise<string>((done) => {
        resolve = done
      })
  )
  const stop = startInstagramAccountMonitor()!
  expect(check).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(120_000)
  expect(check).toHaveBeenCalledOnce()
  let stopped = false
  const stopping = stop().then(() => {
    stopped = true
  })
  await Promise.resolve()
  expect(stopped).toBe(false)
  resolve("idle")
  await stopping
  await vi.advanceTimersByTimeAsync(120_000)
  expect(check).toHaveBeenCalledOnce()
})
it("continues checking after failures without logging credentials", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  check.mockRejectedValueOnce(new Error("SECRET_URL")).mockResolvedValue("idle")
  const stop = startInstagramAccountMonitor()!
  await vi.advanceTimersByTimeAsync(60_000)
  expect(check).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET_URL")
  await stop()
})
it("does not start without ntfy or with demo data", () => {
  configuration.mockReturnValue(null)
  expect(startInstagramAccountMonitor()).toBeUndefined()
  fake.mockReturnValue(true)
  expect(startInstagramAccountMonitor()).toBeUndefined()
  expect(check).not.toHaveBeenCalled()
})
