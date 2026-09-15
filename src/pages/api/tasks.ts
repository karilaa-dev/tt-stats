import type { APIRoute } from "astro"
import { getPrincipal } from "@/lib/auth/session"
import { databaseTasks, taskOwner, validTaskId } from "@/lib/tasks/server"

const handle: APIRoute = async (context) => {
  let ip = "unknown"
  try {
    ip = context.clientAddress
  } catch {
    /* Shared anonymous identity. */
  }
  const owner = taskOwner(
    await getPrincipal(context.cookies),
    context.cookies,
    ip
  )
  const ids = (context.url.searchParams.get("ids") ?? "").split(",")
  if (!ids.length || ids.length > 8 || ids.some((id) => !validTaskId(id)))
    return Response.json({ message: "Invalid task request." }, { status: 400 })
  if (context.request.method === "DELETE") {
    for (const id of ids) databaseTasks.cancel(id, owner)
    return new Response(null, { status: 204 })
  }
  // No query text, account IDs, results, or backend connection IDs are exposed.
  return Response.json(
    Object.fromEntries(
      ids.flatMap((id) => {
        const task = databaseTasks.get(id, owner)
        return task ? [[id, task.status()]] : []
      })
    )
  )
}
export const GET = handle
export const DELETE = handle
