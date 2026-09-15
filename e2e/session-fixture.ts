import type { BrowserContext } from "@playwright/test"
import { seedTestSession } from "../scripts/test-session.mjs"
export async function loginAsAdmin(context: BrowserContext, baseURL: string) {
  const token = await seedTestSession()
  await context.addCookies([
    {
      name: "tt_stats_user",
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ])
}
export { seedTestSession }
