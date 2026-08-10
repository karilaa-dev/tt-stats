"use server"

import { requireSession } from "@/lib/auth/session"
import { startBotstatVerification } from "@/lib/botstat/client"

export interface BotstatActionState {
  status: "idle" | "success" | "error"
  message?: string
  taskId?: string
  nonce: number
}

export async function botstatAction(
  previousState: BotstatActionState
): Promise<BotstatActionState> {
  await requireSession()
  const nonce = previousState.nonce + 1
  let result
  try {
    result = await startBotstatVerification()
  } catch {
    return {
      status: "error",
      message: "Botstat verification is temporarily unavailable.",
      nonce,
    }
  }

  return result.ok
    ? {
        status: "success",
        message: "Botstat verification started.",
        taskId: result.taskId,
        nonce,
      }
    : { status: "error", message: result.message, nonce }
}
