import { describe, expect, it } from "vitest"
import type { APIContext, AstroCookies } from "astro"
import {
  createUserSession,
  deleteUserSession,
  getPrincipal,
  USER_COOKIE,
} from "@/lib/auth/session"
import { databaseTasks, taskOwner } from "@/lib/tasks/server"
import { GET, DELETE } from "@/src/pages/api/tasks"

function context(id: string, token: string, method = "GET") {
  const url = new URL(`https://stats.example.test/api/tasks?ids=${id}`)
  const cookies = {
    get: (name: string) =>
      name === USER_COOKIE ? { value: token } : undefined,
  } as AstroCookies
  return {
    url,
    cookies,
    clientAddress: "192.0.2.1",
    request: new Request(url, { method }),
  } as APIContext
}
describe("task route ownership", () => {
  it("does not expose or cancel another session's request, even for the same account", async () => {
    const token = createUserSession({ id: "42", name: "Owner", username: null })
    const other = createUserSession({ id: "42", name: "Owner", username: null })
    const id = crypto.randomUUID()
    const own = context(id, token)
    const owner = taskOwner(
      getPrincipal(own.cookies),
      own.cookies,
      own.clientAddress
    )
    const task = databaseTasks.start(id, owner)!
    try {
      expect(await (await GET(own)).json()).toHaveProperty(id)
      expect(await (await GET(context(id, other))).json()).toEqual({})
      await DELETE(context(id, other, "DELETE"))
      expect(task.controller.signal.aborted).toBe(false)
      await DELETE(context(id, token, "DELETE"))
      expect(task.controller.signal.aborted).toBe(true)
      deleteUserSession(token)
      expect(await (await GET(own)).json()).toEqual({})
    } finally {
      databaseTasks.finish(id)
      deleteUserSession(token)
      deleteUserSession(other)
    }
  })
  it("rejects invalid IDs and unbounded batches", async () => {
    expect((await GET(context("../secrets", ""))).status).toBe(400)
    expect(
      (
        await GET(
          context(
            Array.from({ length: 9 }, () => crypto.randomUUID()).join(","),
            ""
          )
        )
      ).status
    ).toBe(400)
  })
})
