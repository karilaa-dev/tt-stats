import assert from "node:assert/strict"
import { createServer } from "node:net"
import { once } from "node:events"
import { spawn, sleep } from "bun"

// Exercise the built adapter, where proxy handling differs from astro dev.
const reservation = createServer()
reservation.listen(0, "127.0.0.1")
await once(reservation, "listening")
const port = reservation.address().port
await new Promise((resolve) => reservation.close(resolve))
const server = spawn(["bun", "dist/server/entry.mjs"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    ADMIN_TOKEN: "proxy-test-admin-token-at-least-32-characters",
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
  const login = await fetch(`${base}/api/admin-session`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "proxy-test-admin-token-at-least-32-characters",
    }),
  })
  assert.equal(
    login.status,
    200,
    "Admin login must work behind the HTTPS proxy"
  )
  const cookie = login.headers.get("set-cookie")
  assert.ok(
    cookie?.includes("Secure"),
    "Proxied HTTPS sessions must use Secure cookies"
  )
  assert.ok(cookie?.includes("HttpOnly"))
  const sessionCookie = cookie.split(";")[0]
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
  console.log("Production proxy checks passed")
} finally {
  server.kill()
  await server.exited
}
