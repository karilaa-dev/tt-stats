import type { APIRoute } from "astro"
import { getHistoryCsvResponse } from "@/lib/csv/history"
import { getPrincipal } from "@/lib/auth/session"
export const GET: APIRoute = async ({ params, cookies }) => {
  if (!(await getPrincipal(cookies)).admin) {
    return Response.json(
      { message: "Admin access required." },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
  return getHistoryCsvResponse(params.userId ?? "")
}
