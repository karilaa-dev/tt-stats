import { NextResponse, type NextRequest } from "next/server"

import { sessionCookieName } from "@/lib/auth/cookie"
import { verifySessionToken } from "@/lib/auth/token"
import { getAuthEnv } from "@/lib/env"

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get(sessionCookieName())?.value
    return (await verifySessionToken(token, getAuthEnv())) !== null
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const authenticated = await isAuthenticated(request)
  const { pathname, search } = request.nextUrl

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (
    (pathname.startsWith("/dashboard") || pathname.startsWith("/api/users/")) &&
    !authenticated
  ) {
    const login = new URL("/login", request.url)
    if (pathname.startsWith("/dashboard")) {
      login.searchParams.set("next", `${pathname}${search}`)
    }
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/api/users/:path*"],
}
