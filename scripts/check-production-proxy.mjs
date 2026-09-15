import { seedTestSession } from "./test-session.mjs"
import assert from "node:assert/strict"
import { createServer } from "node:net"
import { once } from "node:events"
import { spawn, sleep } from "bun"
import { readdir, readFile } from "node:fs/promises"

const sessionCookie = `tt_stats_user=${await seedTestSession()}`

// Exercise the built adapter, where proxy handling differs from astro dev.
const reservation = createServer()
reservation.listen(0, "127.0.0.1")
await once(reservation, "listening")
const port = reservation.address().port
await new Promise((resolve) => reservation.close(resolve))
const server = spawn(["bun", "scripts/start.mjs"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    VIDEO_INACTIVITY_WEBHOOK_URL: "",
    VIDEO_INACTIVITY_NTFY_URL: "",
    VIDEO_INACTIVITY_NTFY_TOKEN: "",
    HOST: "127.0.0.1",
    PORT: String(port),
    ADMIN_TELEGRAM_ID: "123456789",
    DB_URL: process.env.TEST_DB_URL,
    BOT_TOKEN: "12345:sentinel_bot_secret",
    TELEGRAM_API_ID: "",
    TELEGRAM_API_HASH: "",
    TELEGRAM_OAUTH_CLIENT_ID: "",
    TELEGRAM_OAUTH_CLIENT_SECRET: "",
    RATE_LIMIT_READ_COUNT: "120",
    RATE_LIMIT_READ_BURST: "60",
    RATE_LIMIT_LOGIN_COUNT: "10",
    RATE_LIMIT_LOGIN_BURST: "5",
  },
  stdout: "ignore",
  stderr: "inherit",
})
const base = `http://127.0.0.1:${port}`
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(`${base}/dashboard`)
      ready = true
      break
    } catch {
      await sleep(100)
    }
  }
  assert.ok(ready, "Production server must start")
  const headers = {
    "X-Forwarded-Host": "tt-stats.karilaa.dev",
    "X-Forwarded-Proto": "https",
    "X-Forwarded-Port": "443",
    Origin: "https://tt-stats.karilaa.dev",
  }
  // No input means Astro sends no JSON content type, just like the browser.
  const response = await fetch(`${base}/_actions/getDashboardMeta`, {
    method: "POST",
    headers,
  })
  assert.equal(response.status, 200, await response.text())
  const session = await fetch(`${base}/api/session`, {
    headers: { ...headers, Cookie: sessionCookie },
  })
  assert.equal(session.status, 200)
  assert.equal((await session.json()).admin, true)
  const authenticated = await fetch(`${base}/_actions/getUserStats`, {
    method: "POST",
    headers: {
      ...headers,
      Cookie: sessionCookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: "invalid" }),
  })
  assert.equal(
    authenticated.status,
    400,
    "Authenticated calls must reach input validation"
  )
  const privateRequest = await fetch(`${base}/_actions/getStatsJobs`, {
    method: "POST",
    headers,
  })
  assert.equal(
    privateRequest.status,
    401,
    "Direct private actions require a session"
  )
  const exportRequest = await fetch(`${base}/api/users/123/history.csv`, {
    headers,
  })
  assert.equal(exportRequest.status, 401, "CSV exports require a session")
  for (const override of [
    { Origin: "https://untrusted.example" },
    {
      "X-Forwarded-Host": "untrusted.example",
      Origin: "https://untrusted.example",
    },
  ]) {
    const rejected = await fetch(`${base}/_actions/getDashboardMeta`, {
      method: "POST",
      headers: { ...headers, ...override },
    })
    assert.equal(rejected.status, 403, "Untrusted origins must remain blocked")
  }
  for (const path of [
    "/.env",
    "/.env.local",
    "/.git/config",
    "/%252eenv",
    "/dist/server/entry.mjs",
    "/src/middleware.ts",
    "/node_modules/astro/package.json",
    "/assets/app.js.map",
  ]) {
    const result = await fetch(`${base}${path}`, { headers })
    assert.equal(
      result.status,
      404,
      `Sensitive path must not be served: ${path}`
    )
  }
  const oversized = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ payload: "x".repeat(20_000) }),
  })
  assert.equal(oversized.status, 413)
  const privatePage = await fetch(`${base}/dashboard/users?id=123`, {
    headers,
    redirect: "manual",
  })
  assert.equal(privatePage.status, 303)
  assert.equal(privatePage.headers.get("location"), "/admin")
  assert.equal(
    (await fetch(`${base}/api/me/history.csv`, { headers })).status,
    401
  )
  const htmlResponse = await fetch(`${base}/dashboard/me`, { headers })
  const html = await htmlResponse.text()
  assert.ok(
    htmlResponse.headers
      .get("content-security-policy")
      ?.includes("frame-ancestors 'none'")
  )
  const csp = htmlResponse.headers.get("content-security-policy")
  assert.match(csp, /script-src[^;]*sha256-/)
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/)
  assert.ok(
    !html.includes("sentinel_password") && !html.includes("sentinel_bot_secret")
  )
  let limited
  for (let i = 0; i < 100; i++) {
    limited = await fetch(`${base}/_actions/getDashboardMeta`, {
      method: "POST",
      headers,
    })
    if (limited.status === 429) break
  }
  assert.equal(limited.status, 429, "Abusive reads must be limited")
  assert.ok(Number(limited.headers.get("retry-after")) > 0)
  for (let i = 0; i < 70; i++) {
    const adminRead = await fetch(`${base}/_actions/getDashboardMeta`, {
      method: "POST",
      headers: { ...headers, Cookie: sessionCookie },
    })
    assert.equal(adminRead.status, 200, "Verified admins are exempt")
  }
  const secrets = [
    "sentinel_password",
    "sentinel_bot_secret",
    "sentinel_oauth_secret",
    "sentinel-admin-secret-with-at-least-32-characters",
  ]
  async function scan(directory) {
    for (const file of await readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${file.name}`
      if (file.isDirectory()) {
        await scan(path)
        continue
      }
      assert.ok(
        !file.name.startsWith(".") && !file.name.endsWith(".map"),
        "Public build contains a sensitive file"
      )
      const content = await readFile(path)
      for (const secret of secrets)
        assert.ok(
          !content.includes(Buffer.from(secret)),
          "Public build contains a sentinel secret"
        )
    }
  }
  await scan("dist/client")
  console.log(
    "Production proxy, sensitive-path, request-size, rate-limit, and client-asset checks passed"
  )
} finally {
  server.kill()
  await server.exited
}
