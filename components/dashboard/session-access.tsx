import { T } from "@/lib/i18n/provider"
import { clearBrowserTasks } from "@/lib/tasks/client"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { BrowserSession } from "@/lib/auth/types"
import { sessionRequest, clearCooldowns } from "@/lib/http-client"
import { buttonVariants } from "@/components/controls"
import { cn } from "@/lib/utils"
import { toast } from "@/components/controls/toast"
import { UserRoundIcon } from "lucide-react"

const SessionContext = createContext<
  BrowserSession & {
    ready: boolean
    logout: () => Promise<void>
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
  const [cacheIdentity, setCacheIdentity] = useState<string | null>(null)
  useEffect(() => {
    // The first session check establishes ownership of the initial cache.
    // Requests already sent with this browser's cookies need no restart.
    if (cacheIdentity === null) {
      if (!session.isPending) setCacheIdentity(identity)
      return
    }
    if (cacheIdentity !== identity) {
      clearBrowserTasks()
      clearCooldowns()
      // Removal cancels in-flight queries too. Keep the workspace unmounted
      // until the old cache is gone so new requests cannot be removed with it.
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      })
      setCacheIdentity(identity)
    }
  }, [identity, cacheIdentity, client, session.isPending])
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
  async function logout() {
    try {
      await clearBrowserTasks()
      const response = await fetch("/api/session", { method: "DELETE" })
      if (!response.ok) throw new Error()
      await client.cancelQueries()
      client.clear()
      clearBrowserTasks()
      clearCooldowns()
      const channel =
        typeof BroadcastChannel !== "undefined"
          ? new BroadcastChannel("tt-stats-session")
          : null
      channel?.postMessage("changed")
      channel?.close()
      window.location.assign("/dashboard/me")
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
      <T>
        {cacheIdentity === null || cacheIdentity === identity ? (
          children
        ) : (
          <p role="status">
            <T>{"Updating your session…"}</T>
          </p>
        )}
      </T>
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
      <T>{user ? "My Profile" : "Log in with Telegram"}</T>
    </a>
  )
}
