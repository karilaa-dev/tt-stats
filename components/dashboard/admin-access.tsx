import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
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
    lockAdmin: () => session.logout(true),
  }
}
export function AdminLockButton() {
  const { authenticated, lockAdmin } = useAdminAccess()
  return authenticated ? (
    <Button variant="ghost" size="sm" onClick={() => void lockAdmin()}>
      Lock admin access
    </Button>
  ) : null
}
export function AdminGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAdminAccess()
  return authenticated ? (
    children
  ) : (
    <p>
      Admin access required.{" "}
      <a href="/admin" className="underline">
        Open admin login
      </a>
    </p>
  )
}
