import "@/lib/server-only"

import { ensureWebsiteSchema, inspectWebsiteSchema } from "@/lib/db/website"
import { getPool } from "@/lib/db/pool"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { validateRuntimeConfiguration } from "@/lib/env"

export async function getHealthResponse(): Promise<Response> {
  if (isFakeDataEnabled()) return Response.json({ status: "ok" })

  try {
    validateRuntimeConfiguration()
    await ensureWebsiteSchema()
    await inspectWebsiteSchema(getPool())
    return Response.json({ status: "ok" })
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 })
  }
}
