import { ActionError, defineAction } from "astro:actions"
import { z } from "zod"
import { getPrincipal } from "@/lib/auth/session"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getScraperStatus as loadStatus } from "@/lib/scraper/queries"
import { fakeScraperStatus } from "@/lib/scraper/fake"

export const getScraperStatus = defineAction({
  input: z.object({
    range: z.enum(["24h", "7d", "30d", "all"]).default("24h"),
  }),
  handler: async ({ range }, context) => {
    if (!(await getPrincipal(context.cookies)).admin)
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Admin access required.",
      })
    return isFakeDataEnabled() ? fakeScraperStatus() : loadStatus(range)
  },
})
