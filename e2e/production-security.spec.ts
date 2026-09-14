import { expect, test } from "@playwright/test"
import { createServer } from "node:net"
import { once } from "node:events"
import { spawn, type ChildProcess } from "node:child_process"
let server: ChildProcess
let base: string

test.beforeAll(async () => {
  const reservation = createServer().listen(0, "127.0.0.1")
  await once(reservation, "listening")
  const port = (reservation.address() as { port: number }).port
  await new Promise<void>((resolve) => reservation.close(() => resolve()))
  base = `http://localhost:${port}`
  server = spawn("bun", ["dist/server/entry.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      DB_URL: "postgresql://test:test@127.0.0.1:1/isolated_test",
      ADMIN_TOKEN: "production-test-token-with-at-least-32-characters",
      BOT_TOKEN: "",
      TELEGRAM_API_ID: "",
      TELEGRAM_API_HASH: "",
      TELEGRAM_OAUTH_CLIENT_ID: "",
      TELEGRAM_OAUTH_CLIENT_SECRET: "",
    },
    stdio: "ignore",
  })
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/admin`)).status === 200) return
    } catch {
      /* Wait for the child to listen. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("Production test server did not start")
})
test.afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM")
    await once(server, "exit")
  }
})

test("production CSP permits hydration and themes, and sensitive paths are denied", async ({
  page,
  request,
}) => {
  const violations: string[] = []
  const errors: string[] = []
  page.on("console", (message) => {
    if (/content security policy|violates.*directive/i.test(message.text()))
      violations.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))
  const response = await page.goto(`${base}/dashboard/me`)
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  )
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  expect(response?.headers()["content-security-policy"]).toMatch(
    /script-src[^;]*sha256-/
  )
  await page.getByRole("button", { name: "Choose theme" }).click()
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(page.locator("html")).toHaveClass(/dark/)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  for (const path of [
    "/.env",
    "/.env.local",
    "/.git/config",
    "/%2eenv",
    "/%252eenv",
    "/dist/server/entry.mjs",
    "/node_modules/astro/package.json",
    "/src/middleware.ts",
    "/assets/app.js.map",
  ]) {
    const response = await request.get(`${base}${path}`)
    expect(response.status(), path).toBe(404)
  }
  expect(violations).toEqual([])
  expect(errors).toEqual([])
})
