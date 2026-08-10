import { describe, expect, it, vi } from "vitest"

import { buildBotstatRequest, mapBotstatResponse } from "@/lib/botstat/client"
import type { BotstatEnv } from "@/lib/env"

const env: BotstatEnv = {
  BOT_TOKEN: "12345:secret token",
  BOTSTAT_ACCESS_KEY: "access/key",
  BOTSTAT_NOTIFY_ID: "1234567",
  BOTSTAT_BASE_URL: "https://www.botstat.io",
}

describe("Botstat integration", () => {
  it("builds the contracted multipart file and query", async () => {
    const request = buildBotstatRequest(["-1009", "42"], env)
    const file = request.formData.get("file")
    expect(file).toBeInstanceOf(File)
    expect(await (file as File).text()).toBe("-1009\n42\n")
    expect((file as File).name).toBe("users.txt")
    expect(request.url.searchParams.get("notify_id")).toBe("1234567")
    expect(request.url.searchParams.get("hide")).toBe("false")
    expect(request.url.searchParams.get("show_file_result")).toBe("true")
  })

  it("accepts only successful responses with a task ID", () => {
    expect(mapBotstatResponse(200, { ok: true, result: { id: 987 } })).toEqual({
      ok: true,
      taskId: "987",
    })
    expect(mapBotstatResponse(200, { ok: false })).toMatchObject({ ok: false })
    expect(mapBotstatResponse(401, { raw: env.BOT_TOKEN })).toEqual({
      ok: false,
      message: "Botstat rejected the configured credentials.",
    })
  })

  it("does not log secrets while mapping failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mapBotstatResponse(422, {
      token: env.BOT_TOKEN,
      access: env.BOTSTAT_ACCESS_KEY,
    })
    expect(log).not.toHaveBeenCalled()
  })
})
