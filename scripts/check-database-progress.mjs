import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { createServer } from "node:net"
import { once } from "node:events"
import { Pool } from "pg"
import { spawn, sleep } from "bun"

const testUrl = process.env.TEST_DB_URL
assert.ok(
  testUrl && new URL(testUrl).pathname.includes("test"),
  "An isolated TEST_DB_URL is required"
)
const pool = new Pool({ connectionString: testUrl })
const locker = await pool.connect()
const role = `progress_${randomBytes(6).toString("hex")}`
const password = randomBytes(24).toString("hex")
const applicationUrl = new URL(testUrl)
applicationUrl.username = role
applicationUrl.password = password
let server
try {
  await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`)
  await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`)
  await pool.query(`GRANT SELECT ON public.videos TO ${role}`)
  const reservation = createServer()
  reservation.listen(0, "127.0.0.1")
  await once(reservation, "listening")
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  server = spawn(["bun", "dist/server/entry.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      DB_URL: applicationUrl.href,
      DB_POOL_SIZE: "1",
      ADMIN_TOKEN: "database-progress-test-admin-at-least-32-characters",
      TELEGRAM_API_ID: "",
      TELEGRAM_API_HASH: "",
      TELEGRAM_OAUTH_CLIENT_ID: "",
      TELEGRAM_OAUTH_CLIENT_SECRET: "",
    },
    stdout: "ignore",
    stderr: "ignore",
  })
  const base = `http://127.0.0.1:${port}`
  const headers = {
    "X-Forwarded-Host": "tt-stats.karilaa.dev",
    "X-Forwarded-Proto": "https",
    "X-Forwarded-Port": "443",
    Origin: "https://tt-stats.karilaa.dev",
  }
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(`${base}/api/session`, { headers })
      ready = true
      break
    } catch {
      await sleep(50)
    }
  }
  assert.ok(ready, "Production server must start")
  const login = await fetch(`${base}/api/admin-session`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "database-progress-test-admin-at-least-32-characters",
    }),
  })
  assert.equal(login.status, 200)
  const authenticated = {
    ...headers,
    Cookie: login.headers.get("set-cookie").split(";")[0],
  }
  await locker.query("BEGIN")
  await locker.query("LOCK TABLE public.videos IN ACCESS EXCLUSIVE MODE")
  const id = randomUUID()
  const pending = fetch(`${base}/_actions/getUserDownloads`, {
    method: "POST",
    headers: {
      ...authenticated,
      "Content-Type": "application/json",
      "X-Database-Task": id,
    },
    body: JSON.stringify({ userId: "1", page: 1, pageSize: 20 }),
    signal: AbortSignal.timeout(10_000),
  })
  let running = false
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE usename = $1 AND wait_event_type = 'Lock'",
      [role]
    )
    if (result.rowCount) {
      running = true
      break
    }
    await sleep(20)
  }
  assert.ok(running, "The real action must be waiting in PostgreSQL")
  const status = await fetch(`${base}/api/tasks?ids=${id}`, {
    headers: authenticated,
  })
  assert.match(status.headers.get("cache-control"), /no-store/)
  assert.equal((await status.json())[id].state, "running")
  assert.deepEqual(
    await (await fetch(`${base}/api/tasks?ids=${id}`, { headers })).json(),
    {}
  )
  assert.equal(
    (
      await fetch(`${base}/api/tasks?ids=${id}`, {
        method: "DELETE",
        headers: { ...authenticated, Origin: "https://untrusted.example" },
      })
    ).status,
    403
  )
  const started = Date.now()
  assert.equal(
    (
      await fetch(`${base}/api/tasks?ids=${id}`, {
        method: "DELETE",
        headers: authenticated,
      })
    ).status,
    204
  )
  assert.equal((await pending).status, 500)
  assert.ok(
    Date.now() - started < 2500,
    "Cancel must interrupt the database wait promptly"
  )
  assert.equal(
    (
      await pool.query(
        "SELECT 1 FROM pg_stat_activity WHERE usename = $1 AND wait_event_type = 'Lock'",
        [role]
      )
    ).rowCount,
    0
  )
  console.log(
    "Production action progress, session isolation, origin checks, and cancellation with a constrained database role passed"
  )
} finally {
  server?.kill()
  if (server) await server.exited
  await locker.query("ROLLBACK")
  locker.release()
  await pool.query(`DROP OWNED BY ${role}`)
  await pool.query(`DROP ROLE ${role}`)
  await pool.end()
}
