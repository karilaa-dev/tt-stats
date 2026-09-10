import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"

const AdminContext = createContext({
  authenticated: false,
  ready: false,
  requireAdmin: async (): Promise<boolean> => false,
  lockAdmin: async (): Promise<void> => {},
})
export const useAdminAccess = () => useContext(AdminContext)

async function getSession() {
  const response = await fetch("/api/admin-session", { cache: "no-store" })
  if (!response.ok) throw new Error("Could not check admin access.")
  return (await response.json()) as { authenticated: boolean }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const session = useQuery({
    queryKey: ["admin-session"],
    queryFn: getSession,
    retry: false,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const authenticated = session.data?.authenticated === true && !session.isError
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const waiting = useRef<Array<(allowed: boolean) => void>>([])
  const finish = useCallback((allowed: boolean) => {
    setOpen(false)
    setToken("")
    setError("")
    waiting.current.splice(0).forEach((resolve) => resolve(allowed))
  }, [])
  const requireAdmin = useCallback(async () => {
    try {
      const value = await client.fetchQuery({
        queryKey: ["admin-session"],
        queryFn: getSession,
        staleTime: 0,
      })
      if (value.authenticated) return true
    } catch {
      // The prompt can retry session creation if the status request failed.
    }
    setOpen(true)
    return new Promise<boolean>((resolve) => waiting.current.push(resolve))
  }, [client])
  const lockAdmin = useCallback(async () => {
    try {
      const response = await fetch("/api/admin-session", { method: "DELETE" })
      if (!response.ok) throw new Error()
      await client.cancelQueries({ queryKey: ["admin-session"] })
      client.setQueryData(["admin-session"], { authenticated: false })
    } catch {
      toast.error("Could not lock admin access. Try again.")
    }
  }, [client])

  useEffect(() => {
    if (!authenticated) {
      const privateQuery = (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] === "telegram-chat" ||
        query.queryKey[0] === "video-notification-status" ||
        (query.queryKey[0] === "stats" &&
          ["user", "jobs", "database-setup", "media", "downloaders"].includes(
            String(query.queryKey[1])
          ))
      void client
        .cancelQueries({ predicate: privateQuery })
        .then(() => client.removeQueries({ predicate: privateQuery }))
    }
  }, [authenticated, client])

  return (
    <AdminContext.Provider
      value={{
        authenticated,
        ready: !session.isPending,
        requireAdmin,
        lockAdmin,
      }}
    >
      {children}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && !pending) finish(false)
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Admin access</DialogTitle>
            <DialogDescription>
              Enter the shared admin token to use Operations and search user
              information. Access lasts eight hours.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              if (pending) return
              setPending(true)
              setError("")
              try {
                const response = await fetch("/api/admin-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token }),
                })
                const result = await response.json()
                if (!response.ok) {
                  setError(result.message ?? "Could not unlock admin access.")
                  return
                }
                await client.cancelQueries({ queryKey: ["admin-session"] })
                client.setQueryData(["admin-session"], { authenticated: true })
                finish(true)
              } catch {
                setError("Could not reach the server. Try again.")
              } finally {
                setPending(false)
              }
            }}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
                <Input
                  id="admin-token"
                  name="admin-token"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  disabled={pending}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "admin-token-error" : undefined}
                />
                {error ? (
                  <FieldError id="admin-token-error" role="alert">
                    {error}
                  </FieldError>
                ) : null}
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => finish(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || !token}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {pending ? "Checking token…" : "Unlock admin access"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </AdminContext.Provider>
  )
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
  const { authenticated, ready, requireAdmin } = useAdminAccess()
  const prompted = useRef(false)
  useEffect(() => {
    if (ready && !authenticated && !prompted.current) {
      prompted.current = true
      void requireAdmin()
    }
  }, [authenticated, ready, requireAdmin])
  if (authenticated) return children
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">
        Admin access required
      </h1>
      <p className="text-muted-foreground">
        Enter the shared admin token to view this page.
      </p>
      <Button disabled={!ready} onClick={() => void requireAdmin()}>
        {ready ? "Enter admin token" : "Checking access…"}
      </Button>
    </div>
  )
}
