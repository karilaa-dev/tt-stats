import "@tanstack/react-start/server-only"

import { Readable } from "node:stream"
import { finished } from "node:stream/promises"

import QueryStream from "pg-query-stream"
import { stringify } from "csv-stringify"
import type { PoolClient } from "pg"

import { historyCsv, type HistoryCsvRow } from "@/lib/csv/format"
import { connect } from "@/lib/db/pool"
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
  try {
    client = await connect()
    const query = new QueryStream(
      `SELECT downloaded_at, shared_link
       FROM videos
       WHERE user_id = $1::bigint
       ORDER BY downloaded_at DESC, pk_id DESC`,
      [parsedId]
    )
    const source = client.query(query)
    const records = stringify({ header: true, columns: ["Time", "Video"] })
    const output = Readable.from(
      (async function* (): AsyncGenerator<HistoryCsvRow> {
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
        }
      })()
    ).pipe(records)
    const checkedOutClient = client
    client = undefined
    void finished(output).then(
      () => checkedOutClient.release(),
      () => checkedOutClient.release()
    )

    return new Response(Readable.toWeb(output) as ReadableStream, {
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
