import type { APIRoute } from "astro"
import { getHistoryCsvResponse } from "@/lib/csv/history"
export const GET: APIRoute = ({ params }) =>
  getHistoryCsvResponse(params.userId ?? "")
