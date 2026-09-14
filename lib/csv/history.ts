import "@/lib/server-only"

import { Readable, pipeline } from "node:stream"

import QueryStream from "pg-query-stream"
import { stringify } from "csv-stringify"
import type { PoolClient } from "pg"

import { historyCsv, type HistoryCsvRow } from "@/lib/csv/format"
import { connect, getPool } from "@/lib/db/pool"
import { cancelClient } from "@/lib/db/cancellation"
import { currentDatabaseTask } from "@/lib/tasks/server"
import { getFakeHistory, isFakeDataEnabled } from "@/lib/dev/fake-data"
import { parseTelegramId } from "@/lib/stats/validation"

export async function getHistoryCsvResponse(userId: string): Promise<Response> {
  const parsedId = parseTelegramId(userId)
  if (!parsedId) {
    return Response.json({ error: "Invalid user ID" }, { status: 400 })
  }

  if (isFakeDataEnabled()) {
    return new Response(historyCsv(getFakeHistory()), {
      headers: csvHeaders(parsedId),
    })
  }

  let client: PoolClient | undefined
  const task = currentDatabaseTask()
  try {
    let total = 0
    if (task) {
      task.report("Counting downloads")
      const count = await getPool().query<{ count: string }>(
        "SELECT count(*)::text AS count FROM videos WHERE user_id = $1::bigint",
        [parsedId]
      )
      total = Number(count.rows[0]?.count ?? 0)
      task.report("Exporting downloads", 0, total)
    }
    client = await connect()
    task?.controller.signal.throwIfAborted()
    const query = new QueryStream(
      `SELECT downloaded_at, shared_link
       FROM videos
       WHERE user_id = $1::bigint
       ORDER BY downloaded_at DESC NULLS LAST, pk_id DESC`,
      [parsedId]
    )
    const source = client.query(query)
    const records = stringify({
      header: true,
      escape_formulas: true,
      columns: ["Time", "Video"],
    })
    let completed = 0
    const rows = Readable.from(
      (async function* (): AsyncGenerator<HistoryCsvRow> {
        try {
          for await (const row of source as AsyncIterable<{
            downloaded_at: string | number | null
            shared_link: string
          }>) {
            yield {
              Time:
                row.downloaded_at === null
                  ? ""
                  : new Date(Number(row.downloaded_at) * 1000).toISOString(),
              Video: row.shared_link,
            }
            completed++
            if (completed % 100 === 0)
              task?.report(
                "Exporting downloads",
                completed,
                Math.max(total, completed)
              )
          }
        } finally {
          source.destroy()
        }
      })()
    )
    const checkedOutClient = client
    client = undefined
    let cancellation: Promise<unknown> | undefined
    const abort = () => {
      cancellation = cancelClient(getPool(), checkedOutClient, task?.id)
      rows.destroy(new Error("Export cancelled"))
    }
    task?.controller.signal.addEventListener("abort", abort, { once: true })
    pipeline(rows, records, () => {
      task?.controller.signal.removeEventListener("abort", abort)
      void Promise.resolve(cancellation).finally(() =>
        checkedOutClient.release(task?.controller.signal.aborted)
      )
    })
    if (task?.controller.signal.aborted) abort()

    // Node and Bun declare different reader overloads for the same web stream.
    return new Response(Readable.toWeb(records) as unknown as ReadableStream, {
      headers: csvHeaders(parsedId),
    })
  } catch {
    client?.release()
    return Response.json(
      { error: "CSV export is temporarily unavailable" },
      { status: 500 }
    )
  }
}

function csvHeaders(userId: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="user_${userId}.csv"`,
    "Cache-Control": "private, no-store",
  }
}
