import type { APIRoute } from "astro"
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  getAdminToken,
  verifyAdminSession,
  verifyAdminToken,
} from "@/lib/admin/session"

const headers = { "Cache-Control": "no-store" }

export const GET: APIRoute = ({ cookies }) =>
  Response.json(
    {
      authenticated: verifyAdminSession(cookies.get(ADMIN_COOKIE)?.value),
    },
    { headers }
  )

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (request.headers.get("origin") !== url.origin) {
    return Response.json(
      { message: "Request origin is not allowed." },
      { status: 403, headers }
    )
  }
  const secret = getAdminToken()
  if (!secret)
    return Response.json(
      {
        message:
          "Admin access is not configured. Set ADMIN_TOKEN on the server.",
      },
      { status: 503, headers }
    )
  let token: unknown
  try {
    if (Number(request.headers.get("content-length")) > 4096) throw new Error()
    const body = await request.text()
    if (body.length > 4096) throw new Error()
    token = JSON.parse(body).token
  } catch {
    return Response.json(
      { message: "Enter an admin token." },
      { status: 400, headers }
    )
  }
  if (typeof token !== "string" || !verifyAdminToken(token, secret)) {
    return Response.json(
      { message: "Incorrect admin token." },
      { status: 401, headers }
    )
  }
  cookies.set(ADMIN_COOKIE, createAdminSession(secret), {
    path: "/",
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_SECONDS,
  })
  return Response.json({ authenticated: true }, { headers })
}

export const DELETE: APIRoute = ({ request, url, cookies }) => {
  if (request.headers.get("origin") !== url.origin) {
    return Response.json(
      { message: "Request origin is not allowed." },
      { status: 403, headers }
    )
  }
  cookies.delete(ADMIN_COOKIE, { path: "/" })
  return Response.json({ authenticated: false }, { headers })
}
