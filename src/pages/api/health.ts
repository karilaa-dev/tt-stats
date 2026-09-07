import type { APIRoute } from "astro"
import { getHealthResponse } from "@/lib/health"
export const GET: APIRoute = () => getHealthResponse()
