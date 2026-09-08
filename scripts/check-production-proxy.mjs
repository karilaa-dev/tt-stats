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
