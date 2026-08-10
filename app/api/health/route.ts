import { getPool } from "@/lib/db/pool"
import { validateRuntimeConfiguration } from "@/lib/env"

export async function GET() {
  try {
    validateRuntimeConfiguration()
    await getPool().query("SELECT 1")
    return Response.json({ status: "ok" })
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 })
  }
}
