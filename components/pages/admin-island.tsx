import { useState } from "react"
import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import { useSession } from "@/components/dashboard/session-access"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
export default function AdminIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <AdminLogin />
    </DashboardShell>
  )
}
function AdminLogin() {
  const { admin } = useSession()
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Admin access</CardTitle>
        <CardDescription>
          Use your admin token to access user lookup and operations. Access
          lasts eight hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {admin ? (
          <div className="flex flex-wrap gap-3">
            <Button nativeButton={false} render={<a href="/dashboard/users" />}>
              User lookup
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/dashboard/jobs" />}
            >
              Operations
            </Button>
          </div>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              if (pending || Date.now() < retryAt) return
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
                  setToken("")
                  if (response.status === 429)
                    setRetryAt(
                      Date.now() +
                        (Number(response.headers.get("Retry-After")) || 60) *
                          1000
                    )
                  setError(result.message ?? "Could not log in. Try again.")
                  return
                }
                setToken("")
                const channel =
                  typeof BroadcastChannel !== "undefined"
                    ? new BroadcastChannel("tt-stats-session")
                    : null
                channel?.postMessage("changed")
                channel?.close()
                window.location.assign("/dashboard/jobs")
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
                  type="password"
                  autoComplete="current-password"
                  maxLength={4096}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  disabled={pending}
                  required
                  aria-invalid={Boolean(error)}
                />
                {error ? <FieldError role="alert">{error}</FieldError> : null}
              </Field>
              <Button type="submit" disabled={pending || !token}>
                {pending ? <Spinner /> : null}Unlock admin access
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
