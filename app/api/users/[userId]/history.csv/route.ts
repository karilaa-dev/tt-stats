import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

import QueryStream from "pg-query-stream"
import { stringify } from "csv-stringify"
import type { PoolClient } from "pg"

import { hasValidSession } from "@/lib/auth/session"
import { connect } from "@/lib/db/pool"
import { parseTelegramId } from "@/lib/stats/validation"

interface RouteContext {
  params: Promise<{ userId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  if (!(await hasValidSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsedId = parseTelegramId((await context.params).userId)
  if (!parsedId) {
    return Response.json({ error: "Invalid user ID" }, { status: 400 })
  }

  let client: PoolClient | undefined
  try {
    client = await connect()
    const query = new QueryStream(
      `SELECT downloaded_at, shared_link
       FROM videos
       WHERE user_id = $1::bigint
       ORDER BY downloaded_at DESC NULLS LAST, pk_id DESC`,
      [parsedId],
      { batchSize: 1_000 }
    )
    const source = client.query(query)
    const rows = new Transform({
      objectMode: true,
      transform(
        row: { downloaded_at: string | number | null; shared_link: string },
        _encoding,
        callback
      ) {
        callback(null, {
          Time:
            row.downloaded_at === null
              ? ""
              : new Date(Number(row.downloaded_at) * 1000).toISOString(),
          Video: row.shared_link,
        })
      },
    })
    const csv = stringify({ header: true, columns: ["Time", "Video"] })
    const output = new Transform({
      transform(chunk, _encoding, callback) {
        callback(null, chunk)
      },
    })

    const checkedOutClient = client
    void pipeline(source, rows, csv, output)
      .catch(() => undefined)
      .finally(() => checkedOutClient.release())

    return new Response(Readable.toWeb(output) as ReadableStream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="user_${parsedId}.csv"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    client?.release()
    return Response.json(
      { error: "Export is temporarily unavailable" },
      { status: 503 }
    )
  }
}
