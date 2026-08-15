import "@tanstack/react-start/server-only"

import type { Pool, PoolClient } from "pg"

import { getPool } from "@/lib/db/pool"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getVideoMonitorEnv, type VideoMonitorEnv } from "@/lib/env"

export const INITIAL_INACTIVITY_MINUTES = 5
export const URGENT_INACTIVITY_MINUTES = 10

export type VideoNotificationSeverity = "test" | "warning" | "critical"

export interface VideoNotification {
  event: "test" | "video_download_inactivity"
  severity: VideoNotificationSeverity
  title: string
  message: string
  inactivityMinutes: number | null
  lastDownloadedAt: string | null
  detectedAt: string
}

interface MonitorStateRow {
  last_downloaded_at: string | null
  stage: number
  monitoring_started_at: Date | string
}

interface LatestDownloadRow {
  latest_downloaded_at: string | null
}

type AlertStage = 1 | 2

export type MonitorResult =
  | { status: "disabled" | "idle" | "locked" }
  | { status: "sent"; stage: AlertStage }

function elapsedMinutes(fromMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - fromMs) / 60_000))
}

function parseEpochSeconds(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function alertStageDue(input: {
  stage: number
  inactivityStartedAtMs: number
  nowMs: number
}): AlertStage | null {
  const inactiveFor = input.nowMs - input.inactivityStartedAtMs
  if (input.stage === 0 && inactiveFor >= INITIAL_INACTIVITY_MINUTES * 60_000) {
    return 1
  }
  if (input.stage === 1 && inactiveFor >= URGENT_INACTIVITY_MINUTES * 60_000) {
    return 2
  }
  return null
}

export function buildInactivityNotification(
  stage: AlertStage,
  lastDownloadedEpoch: number | null,
  nowMs: number,
  inactivityStartedAtMs = lastDownloadedEpoch
    ? lastDownloadedEpoch * 1000
    : nowMs
): VideoNotification {
  const minutes = elapsedMinutes(inactivityStartedAtMs, nowMs)
  const urgent = stage === 2
  return {
    event: "video_download_inactivity",
    severity: urgent ? "critical" : "warning",
    title: urgent
      ? "URGENT: video downloads are still inactive"
      : "No video downloads in the last 5 minutes",
    message: urgent
      ? `No video has been downloaded for ${minutes} minutes. The inactivity is continuing and needs attention.`
      : `No video has been downloaded for ${minutes} minutes.`,
    inactivityMinutes: minutes,
    lastDownloadedAt: lastDownloadedEpoch
      ? new Date(lastDownloadedEpoch * 1000).toISOString()
      : null,
    detectedAt: new Date(nowMs).toISOString(),
  }
}

export function buildTestNotification(nowMs = Date.now()): VideoNotification {
  return {
    event: "test",
    severity: "test",
    title: "TT Stats notification test",
    message:
      "The video-download inactivity notification destination is configured correctly.",
    inactivityMinutes: null,
    lastDownloadedAt: null,
    detectedAt: new Date(nowMs).toISOString(),
  }
}

export function buildNotificationRequest(
  notification: VideoNotification,
  env: VideoMonitorEnv
): { url: string; init: RequestInit } {
  if (env.provider === "webhook") {
    return {
      url: env.url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification),
      },
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    Title: notification.title,
    Priority: notification.severity === "critical" ? "urgent" : "default",
    Tags:
      notification.severity === "critical"
        ? "rotating_light"
        : notification.severity === "warning"
          ? "warning"
          : "white_check_mark",
  }
  if (env.token) headers.Authorization = `Bearer ${env.token}`
  return {
    url: env.url,
    init: { method: "POST", headers, body: notification.message },
  }
}

export async function deliverVideoNotification(
  notification: VideoNotification,
  env: VideoMonitorEnv,
  fetcher: typeof fetch = fetch
): Promise<void> {
  const request = buildNotificationRequest(notification, env)
  let response: Response
  try {
    response = await fetcher(request.url, {
      ...request.init,
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error("The notification destination could not be reached.")
  }
  if (!response.ok) {
    throw new Error(
      `The notification destination returned HTTP ${response.status}.`
    )
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK")
  } catch {
    // Preserve the original monitoring or delivery error.
  }
}

export async function checkVideoInactivity(
  options: {
    pool?: Pool
    fetcher?: typeof fetch
    nowMs?: number
    env?: VideoMonitorEnv | null
  } = {}
): Promise<MonitorResult> {
  if (isFakeDataEnabled()) return { status: "disabled" }
  const env = options.env === undefined ? getVideoMonitorEnv() : options.env
  if (!env) return { status: "disabled" }

  const nowMs = options.nowMs ?? Date.now()
  const now = new Date(nowMs)
  const nowEpoch = Math.floor(nowMs / 1000)
  const client = await (options.pool ?? getPool()).connect()
  try {
    await client.query("BEGIN")
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock(20260814, 1) AS acquired"
    )
    if (!lock.rows[0]?.acquired) {
      await client.query("ROLLBACK")
      return { status: "locked" }
    }

    const [latestResult, stateResult] = await Promise.all([
      client.query<LatestDownloadRow>(
        `SELECT max(downloaded_at)::text AS latest_downloaded_at
         FROM public.videos
         WHERE user_id <> 0
           AND downloaded_at >= 946684800
           AND downloaded_at <= $1`,
        [nowEpoch]
      ),
      client.query<MonitorStateRow>(
        `SELECT last_downloaded_at::text, stage, monitoring_started_at
         FROM tt_stats_cache.video_inactivity_monitor
         WHERE singleton = TRUE
         FOR UPDATE`
      ),
    ])
    const state = stateResult.rows[0]
    if (!state) {
      throw new Error("The video inactivity monitor state is not installed.")
    }

    const latestValue = latestResult.rows[0]?.latest_downloaded_at ?? null
    let stage = state.stage
    let monitoringStartedAtMs = new Date(state.monitoring_started_at).getTime()

    if (latestValue !== state.last_downloaded_at) {
      stage = 0
      monitoringStartedAtMs = nowMs
      await client.query(
        `UPDATE tt_stats_cache.video_inactivity_monitor
         SET last_downloaded_at = $1, stage = 0, stage_changed_at = NULL,
             monitoring_started_at = $2
         WHERE singleton = TRUE`,
        [latestValue, now]
      )
    }

    const latestEpoch = parseEpochSeconds(latestValue)
    const inactivityStartedAtMs = latestEpoch
      ? latestEpoch * 1000
      : monitoringStartedAtMs
    const dueStage = alertStageDue({
      stage,
      inactivityStartedAtMs,
      nowMs,
    })
    if (!dueStage) {
      await client.query("COMMIT")
      return { status: "idle" }
    }

    const notification = buildInactivityNotification(
      dueStage,
      latestEpoch,
      nowMs,
      inactivityStartedAtMs
    )
    await deliverVideoNotification(notification, env, options.fetcher)
    await client.query(
      `UPDATE tt_stats_cache.video_inactivity_monitor
       SET stage = $1, stage_changed_at = $2
       WHERE singleton = TRUE`,
      [dueStage, now]
    )
    await client.query("COMMIT")
    return { status: "sent", stage: dueStage }
  } catch (error) {
    await rollback(client)
    throw error
  } finally {
    client.release()
  }
}
