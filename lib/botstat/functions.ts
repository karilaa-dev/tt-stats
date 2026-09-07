import { actions } from "astro:actions"

export interface BotstatMutationResult {
  status: "success" | "error"
  message: string
  taskId?: string
}

export const startBotstat = () => actions.startBotstat.orThrow()
