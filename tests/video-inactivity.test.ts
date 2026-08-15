import { describe, expect, it, vi } from "vitest"

import { getVideoMonitorEnv, validateRuntimeConfiguration } from "@/lib/env"
import {
  alertStageDue,
  buildInactivityNotification,
  buildNotificationRequest,
  buildTestNotification,
  deliverVideoNotification,
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
