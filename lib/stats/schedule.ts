export const RECOMMENDED_STATS_SCHEDULE = {
  rolling_24h: "*/5 * * * *",
  daily: "7 0 * * *",
} as const

export function validateCronSchedule(value: string): string | null {
  if (!value.trim()) return "Enter a cron schedule."
  if (value.length > 100) return "Cron schedules cannot exceed 100 characters."
  if (
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })
  ) {
    return "Cron schedules cannot contain control characters."
  }
  return null
}
