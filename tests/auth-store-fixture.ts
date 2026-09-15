import { MemoryStore } from "@/lib/auth/memory"
import type { TelegramUser } from "@/lib/auth/types"
import type { LoginTransaction } from "@/lib/auth/session"
const sessions = new MemoryStore<TelegramUser>(1000)
const transactions = new MemoryStore<LoginTransaction>(1000)
export async function saveSession(
  token: string,
  user: TelegramUser,
  seconds: number,
  previous?: string
) {
  sessions.set(token, user, seconds * 1000)
  if (previous) sessions.delete(previous)
}
export async function readSession(token: string) {
  return sessions.get(token) ?? null
}
export async function removeSession(token: string) {
  sessions.delete(token)
}
export const loginTransactions = {
  set: async (token: string, value: LoginTransaction, milliseconds: number) =>
    transactions.set(token, value, milliseconds),
  take: async (token: string) => transactions.take(token),
  delete: async (token: string) => transactions.delete(token),
}
