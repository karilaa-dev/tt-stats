import type { APIRoute } from "astro"
import { getHistoryCsvResponse } from "@/lib/csv/history"
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin/session"
export const GET: APIRoute = ({ params, cookies }) => {
  if (!verifyAdminSession(cookies.get(ADMIN_COOKIE)?.value)) {
    return Response.json(
      { message: "Enter the admin token to continue." },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
  return getHistoryCsvResponse(params.userId ?? "")
}
