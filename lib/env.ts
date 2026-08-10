import "server-only"

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

const authEnvSchema = z.object({
  STATS_USERNAME: z.string().min(1),
  STATS_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
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

export type DbEnv = z.output<typeof dbEnvSchema>
export type AuthEnv = z.output<typeof authEnvSchema>
export type BotstatEnv = z.output<typeof botstatEnvSchema>

export function getDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  return dbEnvSchema.parse(source)
}

export function getAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  return authEnvSchema.parse(source)
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

export function validateRuntimeConfiguration(): void {
  getDbEnv()
  getAuthEnv()
  getBotstatEnv()
}
