// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import {
  SessionProvider,
  useSession,
} from "@/components/dashboard/session-access"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("clears old private queries before starting the next account's requests", async () => {
  let id = "1"
  vi.stubGlobal("fetch", async () =>
    Response.json({
      user: { id, name: id, username: null },
      admin: false,
      loginAvailable: true,
    })
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const pending = new Map<string, (value: string) => void>()
  function Profile({ id }: { id: string }) {
    const query = useQuery({
      queryKey: ["stats", "me", id],
      queryFn: () => new Promise<string>((resolve) => pending.set(id, resolve)),
      staleTime: 60_000,
    })
    return <p>{query.isPending ? `Loading ${id}` : query.data}</p>
  }
  function Workspace() {
    const { user } = useSession()
    return user ? <Profile key={user.id} id={user.id} /> : <p>Signed out</p>
  }
  const view = render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Workspace />
      </SessionProvider>
    </QueryClientProvider>
  )
  await waitFor(() => expect(pending.has("1")).toBe(true))
  await act(async () => pending.get("1")!("First account history"))
  await screen.findByText("First account history")
  client.setQueryData(["stats", "downloaders", "private"], "old identities")
  id = "2"
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["session"] })
  })
  await waitFor(() => expect(pending.has("2")).toBe(true))
  expect(screen.queryByText("First account history")).toBeNull()
  expect(client.getQueryData(["stats", "me", "1"])).toBeUndefined()
  expect(
    client.getQueryData(["stats", "downloaders", "private"])
  ).toBeUndefined()
  await act(async () => pending.get("2")!("Second account history"))
  await screen.findByText("Second account history")
  expect(client.getQueryData(["stats", "me", "2"])).toBe(
    "Second account history"
  )
  view.unmount()
  client.clear()
})
