import { defineMiddleware } from "astro:middleware"
import { ActionError, getActionContext } from "astro:actions"
import { getPrincipal } from "@/lib/auth/session"
import { databaseReads } from "@/lib/tasks/types"
import {
  databaseTasks,
  taskOwner,
  validTaskId,
  withDatabaseTask,
} from "@/lib/tasks/server"
import {
  principalKey,
  rateLimiter,
  type RateClass,
  trackStream,
} from "@/lib/security/rate-limit"

const publicActions = new Set([
  "getDashboardMeta",
  "getSnapshotMetadata",
  "getOverview",
  "getStatsBreakdown",
  "getTimeSeries",
  "getReferralStats",
  "getOtherStats",
  "getPopularVideos",
  "getTelegramMau",
  "getDownloadMedia",
])
const userActions = new Set(["getMyStats", "getMyDownloads", "getMyActivity"])
const adminPages = new Set(["/dashboard/users", "/dashboard/jobs"])

export const onRequest = defineMiddleware(async (context, next) => {
  const { action, serializeActionResult } = getActionContext(context)
  const name = action?.name.replace(/\/$/u, "")
  const path = context.url.pathname.replace(/\/$/u, "")
  const principal = getPrincipal(context.cookies)
  const fail = (status: number, message: string, retryAfter?: number) => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    if (retryAfter) headers.set("Retry-After", String(retryAfter))
    if (action) {
      const code =
        status === 429
          ? "TOO_MANY_REQUESTS"
          : status === 401
            ? "UNAUTHORIZED"
            : status === 403
              ? "FORBIDDEN"
              : status === 413
                ? "CONTENT_TOO_LARGE"
                : "INTERNAL_SERVER_ERROR"
      const result = serializeActionResult({
        data: undefined,
        error: new ActionError({ code, message }),
      })
      return new Response(result.type === "empty" ? null : result.body, {
        status,
        headers,
      })
    }
    return Response.json({ message }, { status, headers })
  }
  async function handle() {
    let decoded = path
    try {
      for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded)
    } catch {
      return new Response(null, { status: 404 })
    }
    if (
      decoded
        .split(/[\\/]/u)
        .some((part) => part.startsWith(".") && part !== ".well-known") ||
      /\.(?:map|sql|pem|key|log|bak)$/iu.test(decoded) ||
      (/^\/(?:node_modules|src|lib|database|dist|server|@fs)(?:\/|$)/iu.test(
        decoded
      ) &&
        import.meta.env.PROD)
    )
      return new Response(null, { status: 404 })
    if (
      !["GET", "HEAD", "OPTIONS"].includes(context.request.method) &&
      context.request.headers.get("origin") !== context.url.origin
    )
      return fail(403, "Request origin is not allowed.")
    if (Number(context.request.headers.get("content-length")) > 16_384)
      return fail(413, "Request is too large.")
    const adminAction =
      name && !publicActions.has(name) && !userActions.has(name)
    if (!principal.admin && (adminAction || path.startsWith("/api/users/")))
      return fail(401, "Admin access required.")
    if (
      !principal.user &&
      ((name && userActions.has(name)) || path.startsWith("/api/me/"))
    )
      return fail(401, "Log in with Telegram to continue.")
    if (!principal.admin && adminPages.has(path))
      return context.redirect("/admin", 303)
    const dynamic =
      Boolean(action) ||
      path.startsWith("/api/") ||
      path.startsWith("/dashboard") ||
      path === "/admin" ||
      path === ""
    if (
      dynamic &&
      !principal.admin &&
      path !== "/api/health" &&
      !(path === "/api/tasks" && context.request.method === "DELETE")
    ) {
      let ip = "unknown"
      try {
        ip = context.clientAddress
      } catch {
        /* A missing address shares a conservative bucket. */
      }
      const login =
        path.startsWith("/api/auth/telegram/") ||
        (path === "/api/admin-session" && context.request.method === "POST")
      const kind: RateClass = login
        ? "login"
        : /^\/api\/media\/[^/]+$/u.test(path)
          ? "metadata"
          : path.startsWith("/api/media/")
            ? "media"
            : name === "getDownloadMedia"
              ? "metadata"
              : path.endsWith("/history.csv")
                ? "csv"
                : "read"
      const seconds = rateLimiter.consume(
        login ? `ip:${ip}` : principalKey(principal, ip),
        kind
      )
      if (seconds)
        return fail(
          429,
          `Please wait ${seconds} seconds before trying again.`,
          seconds
        )
    }
    try {
      const taskId = context.request.headers.get("X-Database-Task")
      let response: Response
      if (
        ((name && Object.hasOwn(databaseReads, name)) ||
          /^\/api\/media\/[^/]+$/u.test(path) ||
          /^\/api\/(?:me|users\/[^/]+)\/history\.csv$/u.test(path)) &&
        taskId &&
        validTaskId(taskId)
      ) {
        let ip = "unknown"
        try {
          ip = context.clientAddress
        } catch {
          /* Shared anonymous identity. */
        }
        const task = databaseTasks.start(
          taskId,
          taskOwner(principal, context.cookies, ip)
        )
        if (!task)
          return fail(429, "Please wait 2 seconds before trying again.", 2)
        const abort = () => task.controller.abort()
        context.request.signal.addEventListener("abort", abort, { once: true })
        const deadline = setTimeout(abort, 120_000)
        const finish = () => {
          clearTimeout(deadline)
          context.request.signal.removeEventListener("abort", abort)
          databaseTasks.finish(taskId)
        }
        let streaming = false
        if (context.request.signal.aborted) abort()
        try {
          response = await withDatabaseTask(task, next)
          if (path.endsWith("/history.csv") && response.ok && response.body) {
            streaming = true
            response = trackStream(response, finish, task.controller.signal)
          }
        } finally {
          if (!streaming) finish()
        }
      } else response = await next()
      if (!principal.admin && action && response.status >= 500)
        return fail(
          response.status,
          "This information is temporarily unavailable. Please try again later."
        )
      return response
    } catch {
      return fail(
        500,
        "This information is temporarily unavailable. Please try again later."
      )
    }
  }
  const response = await handle()
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  response.headers.set(
    "Content-Security-Policy",
    `${response.headers.get("Content-Security-Policy") || "base-uri 'self'; object-src 'none'"}; frame-ancestors 'none'`
  )
  if (context.url.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000")
  if (
    action ||
    path.startsWith("/api/") ||
    path.startsWith("/dashboard") ||
    path === "/admin"
  )
    response.headers.set("Cache-Control", "private, no-store")
  return response
})
