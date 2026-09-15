import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import {
  useSession,
  TelegramLoginButton,
} from "@/components/dashboard/session-access"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/controls"
export default function AdminIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <AdminAccess />
    </DashboardShell>
  )
}
function AdminAccess() {
  const { admin, user, ready } = useSession()
  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle>Admin access</CardTitle>
        <CardDescription>
          Log in with the Telegram account assigned to this website.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <p role="status">Checking your session…</p>
        ) : admin ? (
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
        ) : user ? (
          <p>
            Your Telegram account does not have admin access.{" "}
            <a href="/dashboard/me" className="underline">
              View your profile
            </a>
            .
          </p>
        ) : (
          <TelegramLoginButton />
        )}
      </CardContent>
    </Card>
  )
}
