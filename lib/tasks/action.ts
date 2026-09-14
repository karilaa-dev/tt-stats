import { ActionError, getActionPath } from "astro:actions"
import { parse } from "devalue"
import { noteCooldown } from "@/lib/http-client"
import { databaseReads } from "./types"
import { trackDatabaseRequest } from "./client"

export async function databaseAction<Input, Output>(
  action: { orThrow: (input: Input) => Promise<Output>; toString(): string },
  input: Input,
  signal?: AbortSignal
): Promise<Output> {
  const path = getActionPath(action as Parameters<typeof getActionPath>[0])
  const name = path.split("/").filter(Boolean).at(-1) ?? ""
  const label = databaseReads[name as keyof typeof databaseReads]
  if (!label) throw new Error("This operation cannot be tracked.")
  return trackDatabaseRequest(label, signal, async (id, signal) => {
    const response = await fetch(path, {
      method: "POST",
      signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Database-Task": id,
      },
      body: JSON.stringify(input ?? {}),
    })
    if (response.status === 429)
      throw noteCooldown(
        "read",
        Number(response.headers.get("Retry-After")) || 60
      )
    if (response.status === 204) return undefined as Output
    if (!response.ok) throw ActionError.fromJson(await response.json())
    return parse(await response.text(), {
      URL: (href) => new URL(href),
    }) as Output
  })
}
