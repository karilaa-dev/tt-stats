import "@/lib/server-only"

import { z } from "zod"

const postgresUrl = z
  .string()
  .min(1)
  .superRefine((value, context) => {
    try {
      const url = new URL(value)
      if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        context.addIssue({ code: "custom", message: "must use PostgreSQL" })
      }
    } catch {
      context.addIssue({ code: "custom", message: "must be a valid URL" })
    }
  })

const dbEnvSchema = z.object({
  DB_URL: postgresUrl,
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
})

const telegramEnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  TELEGRAM_API_ID: z.coerce.number().int().positive(),
  TELEGRAM_API_HASH: z.string().regex(/^[a-fA-F0-9]{32}$/u),
})

const optionalHttpUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value)
      return (
        ["http:", "https:"].includes(url.protocol) &&
        url.username === "" &&
        url.password === ""
      )
    })
    .optional()
)

const videoMonitorEnvSchema = z
  .object({
    VIDEO_INACTIVITY_WEBHOOK_URL: optionalHttpUrl,
    VIDEO_INACTIVITY_NTFY_URL: optionalHttpUrl,
    VIDEO_INACTIVITY_NTFY_TOKEN: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().min(1).optional()
    ),
  })
  .superRefine((value, context) => {
    if (value.VIDEO_INACTIVITY_WEBHOOK_URL && value.VIDEO_INACTIVITY_NTFY_URL) {
      context.addIssue({
        code: "custom",
        message: "configure either a webhook or ntfy, not both",
      })
    }
    if (value.VIDEO_INACTIVITY_NTFY_TOKEN && !value.VIDEO_INACTIVITY_NTFY_URL) {
      context.addIssue({
        code: "custom",
        message: "an ntfy token requires an ntfy topic URL",
      })
    }
  })

export type DbEnv = z.output<typeof dbEnvSchema>
export type TelegramEnv = z.output<typeof telegramEnvSchema>
export type VideoMonitorEnv =
  | { provider: "webhook"; url: string }
  | { provider: "ntfy"; url: string; token?: string }

export function getDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  return dbEnvSchema.parse(source)
}

export function getTelegramEnv(
  source: NodeJS.ProcessEnv = process.env
): TelegramEnv | null {
  if (!source.TELEGRAM_API_ID?.trim() && !source.TELEGRAM_API_HASH?.trim())
    return null
  return telegramEnvSchema.parse(source)
}

export function getVideoMonitorEnv(
  source: NodeJS.ProcessEnv = process.env
): VideoMonitorEnv | null {
  const parsed = videoMonitorEnvSchema.parse(source)
  if (parsed.VIDEO_INACTIVITY_WEBHOOK_URL) {
    return { provider: "webhook", url: parsed.VIDEO_INACTIVITY_WEBHOOK_URL }
  }
  if (parsed.VIDEO_INACTIVITY_NTFY_URL) {
    return {
      provider: "ntfy",
      url: parsed.VIDEO_INACTIVITY_NTFY_URL,
      token: parsed.VIDEO_INACTIVITY_NTFY_TOKEN,
    }
  }
  return null
}

export function validateRuntimeConfiguration(
  source: NodeJS.ProcessEnv = process.env
): void {
  getDbEnv(source)
}
