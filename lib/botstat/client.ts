import "@tanstack/react-start/server-only"

import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getBotstatEnv, type BotstatEnv } from "@/lib/env"
import { getBotstatUserIdsRaw } from "@/lib/stats/queries"

export type BotstatResult =
  { ok: true; taskId: string } | { ok: false; message: string }

function safeFailure(status?: number): string {
  switch (status) {
    case 400:
    case 422:
      return "Botstat rejected the verification request. Check the configured IDs and credentials."
    case 401:
      return "Botstat rejected the configured credentials."
    case 409:
      return "A Botstat verification is already running for this bot."
    default:
      return "Botstat verification is temporarily unavailable."
  }
}

export function mapBotstatResponse(
  status: number,
  body: unknown
): BotstatResult {
  if (status !== 200) return { ok: false, message: safeFailure(status) }
  if (!body || typeof body !== "object") {
    return { ok: false, message: safeFailure() }
  }

  const record = body as Record<string, unknown>
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : undefined
  const taskId = record.task_id ?? record.taskId ?? record.id ?? result?.id
  if (record.ok !== true || !["string", "number"].includes(typeof taskId)) {
    return { ok: false, message: safeFailure() }
  }

  return { ok: true, taskId: String(taskId) }
}

export function buildBotstatRequest(ids: string[], env: BotstatEnv) {
  const fileContents = ids.length > 0 ? `${ids.join("\n")}\n` : ""
  const formData = new FormData()
  formData.append(
    "file",
    new Blob([fileContents], { type: "text/plain;charset=utf-8" }),
    "users.txt"
  )

  const url = new URL(
    `/create/${encodeURIComponent(env.BOT_TOKEN)}/${encodeURIComponent(env.BOTSTAT_ACCESS_KEY)}`,
    env.BOTSTAT_BASE_URL
  )
  url.searchParams.set("notify_id", env.BOTSTAT_NOTIFY_ID)
  url.searchParams.set("hide", "false")
  url.searchParams.set("show_file_result", "true")
  return { formData, url }
}

export async function startBotstatVerification(
  fetcher: typeof fetch = fetch
): Promise<BotstatResult> {
  if (isFakeDataEnabled()) {
    return { ok: true, taskId: "demo-task-no-data-uploaded" }
  }

  const env = getBotstatEnv()
  const ids = await getBotstatUserIdsRaw()
  const { formData, url } = buildBotstatRequest(ids, env)

  try {
    const response = await fetcher(url, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60_000),
    })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // An invalid response is handled without exposing its body.
    }
    return mapBotstatResponse(response.status, body)
  } catch {
    return { ok: false, message: safeFailure() }
  }
}
