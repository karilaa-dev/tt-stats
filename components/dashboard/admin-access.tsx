import { T } from "@/lib/i18n/provider"
import type { ReactNode } from "react"
import { SessionProvider, useSession } from "./session-access"
export const AdminProvider = SessionProvider
export function useAdminAccess() {
  const session = useSession()
  return {
    authenticated: session.admin,
    ready: session.ready,
    requireAdmin: async () => {
      if (session.admin) return true
      window.location.assign("/admin")
      return false
    },
  }
}
export function AdminGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAdminAccess()
  return authenticated ? (
    children
  ) : (
    <p>
      <T>{"Admin access required."}</T>{" "}
      <a href="/admin" className="underline">
        <T>{"Open admin login"}</T>
      </a>
    </p>
  )
}
