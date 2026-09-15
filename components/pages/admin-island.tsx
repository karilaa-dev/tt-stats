import { T } from "@/lib/i18n/provider"
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
        <CardTitle>
          <T>{"Admin access"}</T>
        </CardTitle>
        <CardDescription>
          <T>{"Log in with the Telegram account assigned to this website."}</T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <p role="status">
            <T>{"Checking your session…"}</T>
          </p>
        ) : admin ? (
          <div className="flex flex-wrap gap-3">
            <Button nativeButton={false} render={<a href="/dashboard/users" />}>
              <T>{"User lookup"}</T>
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/dashboard/jobs" />}
            >
              <T>{"Operations"}</T>
            </Button>
          </div>
        ) : user ? (
          <p>
            <T>{"Your Telegram account does not have admin access."}</T>{" "}
            <a href="/dashboard/me" className="underline">
              <T>{"View your profile"}</T>
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
