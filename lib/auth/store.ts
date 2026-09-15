import "@/lib/server-only"
import { createHash } from "node:crypto"
import { getAuthPool } from "@/lib/db/pool"
import { ensureWebsiteSchema } from "@/lib/db/website"
import type { TelegramUser } from "./types"
import type { LoginTransaction } from "./session"

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")
export async function saveSession(
  token: string,
  user: TelegramUser,
  seconds: number,
  previous?: string
) {
  await ensureWebsiteSchema()
  const client = await getAuthPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `INSERT INTO tt_stats_web.users (telegram_id, display_name, username) VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, last_login_at = now()`,
      [user.id, user.name, user.username]
    )
    await client.query(
      `INSERT INTO tt_stats_web.sessions(token_hash, telegram_id, expires_at) VALUES ($1, $2, now() + $3 * interval '1 second')`,
      [hashToken(token), user.id, seconds]
    )
    if (previous)
      await client.query(
        "DELETE FROM tt_stats_web.sessions WHERE token_hash = $1",
        [hashToken(previous)]
      )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
export async function readSession(token: string): Promise<TelegramUser | null> {
  await ensureWebsiteSchema()
  const result = await getAuthPool().query<TelegramUser>(
    `SELECT u.telegram_id::text AS id, u.display_name AS name, u.username
    FROM tt_stats_web.sessions s JOIN tt_stats_web.users u USING (telegram_id)
    WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  )
  return result.rows[0] ?? null
}
export async function removeSession(token: string) {
  await ensureWebsiteSchema()
  await getAuthPool().query(
    "DELETE FROM tt_stats_web.sessions WHERE token_hash = $1",
    [hashToken(token)]
  )
}
export const loginTransactions = {
  async set(token: string, payload: LoginTransaction, milliseconds: number) {
    await ensureWebsiteSchema()
    await getAuthPool().query(
      `INSERT INTO tt_stats_web.login_transactions(token_hash, payload, expires_at) VALUES ($1, $2, now() + $3 * interval '1 millisecond')`,
      [hashToken(token), JSON.stringify(payload), milliseconds]
    )
  },
  async take(token: string): Promise<LoginTransaction | undefined> {
    await ensureWebsiteSchema()
    const result = await getAuthPool().query<{ payload: LoginTransaction }>(
      `DELETE FROM tt_stats_web.login_transactions WHERE token_hash = $1 RETURNING CASE WHEN expires_at > now() THEN payload ELSE NULL END AS payload`,
      [hashToken(token)]
    )
    return result.rows[0]?.payload ?? undefined
  },
  async delete(token: string) {
    await ensureWebsiteSchema()
    await getAuthPool().query(
      "DELETE FROM tt_stats_web.login_transactions WHERE token_hash = $1",
      [hashToken(token)]
    )
  },
}
