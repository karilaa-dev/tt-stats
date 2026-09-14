import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cancelBrowserTask,
  getTasks,
  refreshTaskProgress,
  trackDatabaseRequest,
} from "@/lib/tasks/client"
import {
  clearCooldowns,
  databaseRefreshInterval,
  noteCooldown,
  RequestCancelledError,
} from "@/lib/http-client"

afterEach(() => {
  clearCooldowns()
  vi.unstubAllGlobals()
})
describe("database request cancellation in the browser", () => {
  it("can cancel during a read cooldown and does not poll or restart cancelled work", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetch)
    const pending = trackDatabaseRequest(
      "Loading history",
      undefined,
      async (_id, signal) => {
        await new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          })
        )
      }
    ).catch((error) => error)
    expect(getTasks()).toHaveLength(1)
    const id = getTasks()[0]!.id
    noteCooldown("read", 60)
    await expect(
      refreshTaskProgress(new AbortController().signal)
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" })
    expect(fetch).not.toHaveBeenCalled()
    await cancelBrowserTask(id)
    const error = await pending
    expect(error).toBeInstanceOf(RequestCancelledError)
    expect(fetch).toHaveBeenCalledWith(
      `/api/tasks?ids=${id}`,
      expect.objectContaining({ method: "DELETE" })
    )
    expect(getTasks()).toHaveLength(0)
    expect(databaseRefreshInterval(60_000)({ state: { error } })).toBe(false)
  })
  it("sends server cancellation when a query is abandoned", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetch)
    const controller = new AbortController()
    const pending = trackDatabaseRequest(
      "Loading history",
      controller.signal,
      async (_id, signal) => {
        await new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          })
        )
      }
    ).catch((error) => error)
    controller.abort()
    expect(await pending).toBeInstanceOf(RequestCancelledError)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tasks?ids="),
      expect.objectContaining({ method: "DELETE", keepalive: true })
    )
    expect(getTasks()).toHaveLength(0)
  })
})
