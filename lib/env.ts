import "@tanstack/react-start/server-only"

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

const botstatEnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOTSTAT_ACCESS_KEY: z.string().min(1),
  BOTSTAT_NOTIFY_ID: z.string().regex(/^\d+$/u),
  BOTSTAT_BASE_URL: z
    .string()
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol))
    .default("https://www.botstat.io"),
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
export type BotstatEnv = z.output<typeof botstatEnvSchema>
export type VideoMonitorEnv =
  | { provider: "webhook"; url: string }
  | { provider: "ntfy"; url: string; token?: string }

export function getDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  return dbEnvSchema.parse(source)
}

export function getBotstatEnv(
  source: NodeJS.ProcessEnv = process.env
): BotstatEnv {
  const parsed = botstatEnvSchema.parse(source)
  return {
    ...parsed,
    BOTSTAT_BASE_URL: parsed.BOTSTAT_BASE_URL.replace(/\/+$/u, ""),
  }
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
  getBotstatEnv(source)
}
