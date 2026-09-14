import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { BrowserSession } from "@/lib/auth/types"
import { sessionRequest, clearCooldowns } from "@/lib/http-client"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { UserRoundIcon } from "lucide-react"

const SessionContext = createContext<
  BrowserSession & {
    ready: boolean
    logout: (admin?: boolean) => Promise<void>
  }
>({
  user: null,
  admin: false,
  loginAvailable: false,
  ready: false,
  logout: async () => {},
})
export const useSession = () => useContext(SessionContext)
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const session = useQuery<BrowserSession>({
    queryKey: ["session"],
    queryFn: sessionRequest,
    retry: false,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const data = session.isError ? undefined : session.data
  const identity = `${data?.user?.id ?? ""}:${data?.admin ?? false}`
  const previous = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (previous.current === undefined) {
      if (!session.isPending) previous.current = identity
      return
    }
    if (previous.current !== identity) {
      previous.current = identity
      clearCooldowns()
      const predicate = (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] !== "session"
      void client
        .cancelQueries({ predicate })
        .then(() => client.removeQueries({ predicate }))
    }
  }, [identity, client, session.isPending])
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["session"] })
    }
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("tt-stats-session")
        : null
    if (channel) channel.onmessage = refresh
    window.addEventListener("pageshow", refresh)
    return () => {
      channel?.close()
      window.removeEventListener("pageshow", refresh)
    }
  }, [client])
  async function logout(admin = false) {
    try {
      const response = await fetch(
        admin ? "/api/admin-session" : "/api/session",
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error()
      await client.cancelQueries()
      client.clear()
      clearCooldowns()
      const channel =
        typeof BroadcastChannel !== "undefined"
          ? new BroadcastChannel("tt-stats-session")
          : null
      channel?.postMessage("changed")
      channel?.close()
      window.location.assign(admin ? "/admin" : "/dashboard/me")
    } catch {
      toast.error("Could not log out. Try again.")
    }
  }
  return (
    <SessionContext.Provider
      value={{
        user: data?.user ?? null,
        admin: data?.admin ?? false,
        loginAvailable: data?.loginAvailable ?? false,
        ready: !session.isPending,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
export function TelegramLoginButton({
  compact = false,
}: {
  compact?: boolean
}) {
  const { user } = useSession()
  return (
    <a
      href={user ? "/dashboard/me" : "/api/auth/telegram/start"}
      className={cn(
        buttonVariants(),
        "telegram-login",
        compact && "telegram-login-compact"
      )}
    >
      <UserRoundIcon aria-hidden="true" data-icon="inline-start" />
      My profile
    </a>
  )
}
