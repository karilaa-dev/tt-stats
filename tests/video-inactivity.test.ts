import { describe, expect, it, vi } from "vitest"
import type { Pool } from "pg"

import { getVideoMonitorEnv, validateRuntimeConfiguration } from "@/lib/env"
import {
  alertStageDue,
  buildInactivityNotification,
  buildNotificationRequest,
  buildRecoveryNotification,
  buildTestNotification,
  checkVideoInactivity,
  deliverVideoNotification,
  recoveryInactivityMinutes,
} from "@/lib/notifications/video-inactivity"

describe("video inactivity notification configuration", () => {
  it("supports either a generic webhook or an authenticated ntfy topic", () => {
    expect(
      getVideoMonitorEnv({
        VIDEO_INACTIVITY_WEBHOOK_URL: "https://example.test/hook",
      })
    ).toEqual({ provider: "webhook", url: "https://example.test/hook" })
    expect(
      getVideoMonitorEnv({
        VIDEO_INACTIVITY_NTFY_URL: "https://ntfy.sh/private-topic",
        VIDEO_INACTIVITY_NTFY_TOKEN: "secret",
      })
    ).toEqual({
      provider: "ntfy",
      url: "https://ntfy.sh/private-topic",
      token: "secret",
    })
    expect(getVideoMonitorEnv({})).toBeNull()
  })

  it("rejects ambiguous or malformed destination settings", () => {
    expect(() =>
      getVideoMonitorEnv({
        VIDEO_INACTIVITY_WEBHOOK_URL: "https://example.test/hook",
        VIDEO_INACTIVITY_NTFY_URL: "https://ntfy.sh/topic",
      })
    ).toThrow()
    expect(() =>
      getVideoMonitorEnv({ VIDEO_INACTIVITY_NTFY_TOKEN: "orphaned" })
    ).toThrow()
    expect(() =>
      getVideoMonitorEnv({ VIDEO_INACTIVITY_WEBHOOK_URL: "file:///tmp/hook" })
    ).toThrow()
    expect(() =>
      getVideoMonitorEnv({
        VIDEO_INACTIVITY_WEBHOOK_URL: "https://user:password@example.test/hook",
      })
    ).toThrow()
    expect(() =>
      getVideoMonitorEnv({
        VIDEO_INACTIVITY_NTFY_URL: "https://token@ntfy.sh/private-topic",
      })
    ).toThrow()
  })

  it("does not fail core health validation for optional alerting errors", () => {
    expect(() =>
      validateRuntimeConfiguration({
        DB_URL: "postgresql://app:secret@database.test/ttbot",
        BOT_TOKEN: "12345:secret",
        BOTSTAT_ACCESS_KEY: "access-key",
        BOTSTAT_NOTIFY_ID: "1234567",
        VIDEO_INACTIVITY_WEBHOOK_URL: "https://example.test/hook",
        VIDEO_INACTIVITY_NTFY_URL: "not-a-valid-url",
      })
    ).not.toThrow()
  })
})

describe("video inactivity escalation", () => {
  const minute = 60_000

  it("sends the first alert at five minutes and escalates five minutes later", () => {
    expect(
      alertStageDue({
        stage: 0,
        inactivityStartedAtMs: 0,
        nowMs: 5 * minute - 1,
      })
    ).toBeNull()
    expect(
      alertStageDue({
        stage: 0,
        inactivityStartedAtMs: 0,
        nowMs: 5 * minute,
      })
    ).toBe(1)
    expect(
      alertStageDue({
        stage: 1,
        inactivityStartedAtMs: 0,
        nowMs: 10 * minute,
      })
    ).toBe(2)
    expect(
      alertStageDue({
        stage: 2,
        inactivityStartedAtMs: 0,
        nowMs: 30 * minute,
      })
    ).toBeNull()
  })

  it("does not delay an urgent alert because consecutive checks have jitter", () => {
    expect(
      alertStageDue({
        stage: 1,
        inactivityStartedAtMs: 0,
        nowMs: 10 * minute,
      })
    ).toBe(2)
  })

  it("builds increasingly urgent messages with safe timestamps", () => {
    const now = Date.parse("2026-08-14T12:10:00.000Z")
    const latest = Math.floor(now / 1000) - 600
    const initial = buildInactivityNotification(1, latest, now)
    const urgent = buildInactivityNotification(2, latest, now)

    expect(initial).toMatchObject({
      event: "video_download_inactivity",
      severity: "warning",
      inactivityMinutes: 10,
    })
    expect(urgent.severity).toBe("critical")
    expect(urgent.title).toContain("URGENT")
    expect(urgent.lastDownloadedAt).toBe("2026-08-14T12:00:00.000Z")
  })

  it("detects a download that resumes after five quiet minutes", () => {
    expect(
      recoveryInactivityMinutes({
        previousDownloadedEpoch: 1_000,
        monitoringStartedAtMs: 0,
        resumedDownloadedEpoch: 1_299,
      })
    ).toBeNull()
    expect(
      recoveryInactivityMinutes({
        previousDownloadedEpoch: 1_000,
        monitoringStartedAtMs: 0,
        resumedDownloadedEpoch: 1_300,
      })
    ).toBe(5)
  })

  it("builds a success notification when downloads resume", () => {
    const notification = buildRecoveryNotification(1_300, 1_000_000, 1_301_000)

    expect(notification).toMatchObject({
      event: "video_download_recovery",
      severity: "success",
      title: "Bot is working",
      message:
        "A video was downloaded after 5 minutes of inactivity. The bot is working.",
      inactivityMinutes: 5,
      lastDownloadedAt: "1970-01-01T00:21:40.000Z",
    })
  })
})

describe("video notification delivery", () => {
  it("posts structured JSON to a generic webhook", async () => {
    const notification = buildTestNotification(0)
    const request = buildNotificationRequest(notification, {
      provider: "webhook",
      url: "https://example.test/hook",
    })
    expect(request.init.headers).toEqual({
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(request.init.body))).toEqual(notification)

    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    await deliverVideoNotification(
      notification,
      { provider: "webhook", url: "https://example.test/hook" },
      fetcher
    )
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it("uses ntfy priority, tags, and bearer authentication", () => {
    const request = buildNotificationRequest(
      {
        ...buildTestNotification(0),
        severity: "critical",
      },
      {
        provider: "ntfy",
        url: "https://ntfy.sh/private-topic",
        token: "secret",
      }
    )
    expect(request.init.headers).toMatchObject({
      Authorization: "Bearer secret",
      Priority: "urgent",
      Tags: "rotating_light",
    })
  })

  it("reports unsuccessful destinations without exposing response bodies", async () => {
    await expect(
      deliverVideoNotification(
        buildTestNotification(0),
        { provider: "webhook", url: "https://example.test/hook" },
        async () => new Response("secret response", { status: 503 })
      )
    ).rejects.toThrow("HTTP 503")
  })
})

describe("video inactivity monitoring", () => {
  it("sends one recovery notification when a download follows a quiet period", async () => {
    let state = {
      last_downloaded_at: "1000" as string | null,
      stage: 1,
      monitoring_started_at: new Date(1_000_000),
    }
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ acquired: true }] }
      }
      if (text.includes("max(downloaded_at)")) {
        return { rows: [{ latest_downloaded_at: "1300" }] }
      }
      if (text.includes("SELECT last_downloaded_at::text")) {
        return { rows: [state] }
      }
      if (text.includes("SET last_downloaded_at")) {
        state = {
          last_downloaded_at: String(values?.[0]),
          stage: 0,
          monitoring_started_at: values?.[1] as Date,
        }
      }
      return { rows: [] }
    })
    const client = { query, release: vi.fn() }
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool
    const deliveredBodies: BodyInit[] = []
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.body) deliveredBodies.push(init.body)
        return new Response(null, { status: 204 })
      }
    )
    const options = {
      pool,
      env: {
        provider: "webhook" as const,
        url: "https://example.test/hook",
      },
      fetcher,
      nowMs: 1_400_000,
    }

    await expect(checkVideoInactivity(options)).resolves.toEqual({
      status: "sent",
      kind: "recovery",
    })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(JSON.parse(String(deliveredBodies[0]))).toMatchObject({
      event: "video_download_recovery",
      inactivityMinutes: 5,
    })

    await expect(checkVideoInactivity(options)).resolves.toEqual({
      status: "idle",
    })
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
