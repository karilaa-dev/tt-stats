import { randomBytes, createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Pool } from "pg"

// Test runner only. No production route can mint sessions without Telegram OAuth.
export async function seedTestSession(telegramId = "123456789") {
  const url = process.env.TEST_DB_URL
  if (!url || !new URL(url).pathname.includes("test"))
    throw new Error("An isolated TEST_DB_URL is required for session fixtures")
  const pool = new Pool({ connectionString: url })
  const token = randomBytes(32).toString("base64url")
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(784621, 1)")
    await client.query(
      await readFile(
        new URL("../database/005_website.sql", import.meta.url),
        "utf8"
      )
    )
    await client.query(
      `INSERT INTO tt_stats_web.users(telegram_id, display_name, username) VALUES ($1, 'Alex Example', 'alex_example') ON CONFLICT (telegram_id) DO NOTHING`,
      [telegramId]
    )
    await client.query(
      "INSERT INTO tt_stats_web.sessions(token_hash, telegram_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
      [createHash("sha256").update(token).digest("hex"), telegramId]
    )
    await client.query("COMMIT")
    return token
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
