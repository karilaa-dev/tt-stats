import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  requireSession: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
  headers: vi.fn(),
}))

vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  deleteSession: mocks.deleteSession,
  requireSession: mocks.requireSession,
}))
vi.mock("@/lib/env", () => ({
  getAuthEnv: () => ({
    STATS_USERNAME: "admin",
    STATS_PASSWORD: "password",
    SESSION_SECRET: "01234567890123456789012345678901",
  }),
}))
vi.mock("next/headers", () => ({ headers: mocks.headers }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("next/cache", () => ({
  refresh: mocks.refresh,
  updateTag: mocks.updateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { loginAction, logoutAction, refreshStatsAction } from "@/app/actions"

let nextIp = 1

function loginData(username: string, password: string) {
  const data = new FormData()
  data.set("username", username)
  data.set("password", password)
  return data
}

describe("authenticated actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.headers.mockResolvedValue(
      new Headers({ "x-forwarded-for": `192.0.2.${nextIp}` })
    )
    nextIp += 1
    mocks.requireSession.mockResolvedValue(undefined)
  })

  it("returns the same accessible error for unknown usernames and wrong passwords", async () => {
    expect(await loginAction({}, loginData("unknown", "password"))).toEqual({
      error: "Invalid username or password.",
    })
    expect(await loginAction({}, loginData("admin", "wrong"))).toEqual({
      error: "Invalid username or password.",
    })
  })

  it("creates a session and redirects a successful login", async () => {
    const data = loginData("admin", "password")
    data.set("next", "/dashboard/analytics?range=7d")
    await expect(loginAction({}, data)).rejects.toThrow(
      "REDIRECT:/dashboard/analytics?range=7d"
    )
    expect(mocks.createSession).toHaveBeenCalledOnce()
  })

  it("revalidates authorization before logout and cache refresh", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login")
    expect(mocks.requireSession).toHaveBeenCalledOnce()
    expect(mocks.deleteSession).toHaveBeenCalledOnce()

    await refreshStatsAction()
    expect(mocks.requireSession).toHaveBeenCalledTimes(2)
    expect(mocks.updateTag).toHaveBeenCalledWith("stats")
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it("does not invalidate cache when authorization fails", async () => {
    mocks.requireSession.mockRejectedValueOnce(new Error("unauthorized"))
    await expect(refreshStatsAction()).rejects.toThrow("unauthorized")
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })
})
