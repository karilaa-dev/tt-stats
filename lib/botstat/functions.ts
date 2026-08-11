import { createServerFn } from "@tanstack/react-start"

import { startBotstatVerification } from "@/lib/botstat/client"

export interface BotstatMutationResult {
  status: "success" | "error"
  message: string
  taskId?: string
}

export const startBotstat = createServerFn({ method: "POST" }).handler(
  async (): Promise<BotstatMutationResult> => {
    try {
      const result = await startBotstatVerification()
      return result.ok
        ? {
            status: "success",
            message: "Botstat verification started.",
            taskId: result.taskId,
          }
        : { status: "error", message: result.message }
    } catch {
      return {
        status: "error",
        message: "Botstat verification is temporarily unavailable.",
      }
    }
  }
)
