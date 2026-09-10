import { defineMiddleware } from "astro:middleware"
import { ActionError, getActionContext } from "astro:actions"
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin/session"

// New actions require admin access unless explicitly made public here.
const publicActions = new Set([
  "getDashboardMeta",
  "getSnapshotMetadata",
  "getOverview",
  "getStatsBreakdown",
  "getTimeSeries",
  "getReferralStats",
  "getOtherStats",
  "getTelegramMau",
])

export const onRequest = defineMiddleware(async (context, next) => {
  const { action, serializeActionResult } = getActionContext(context)
  const privateAction =
    action && !publicActions.has(action.name.replace(/\/$/u, ""))
  const privateCsv = context.url.pathname.startsWith("/api/users/")
  if (privateAction || privateCsv) {
    if (
      privateAction &&
      context.request.headers.get("origin") !== context.url.origin
    ) {
      return Response.json(
        { message: "Request origin is not allowed." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (!verifyAdminSession(context.cookies.get(ADMIN_COOKIE)?.value)) {
      const result = serializeActionResult({
        data: undefined,
        error: new ActionError({
          code: "UNAUTHORIZED",
          message: "Enter the admin token to continue.",
        }),
      })
      return new Response(result.type === "empty" ? null : result.body, {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      })
    }
  }
  const response = await next()
  if (
    privateAction ||
    privateCsv ||
    context.url.pathname.startsWith("/api/admin-session")
  ) {
    response.headers.set("Cache-Control", "no-store")
  }
  return response
})
