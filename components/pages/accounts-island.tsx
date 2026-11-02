import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import { AdminGate } from "@/components/dashboard/admin-access"
import { ScraperAccountsPage } from "./accounts"
export default function AccountsIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <AdminGate>
        <ScraperAccountsPage />
      </AdminGate>
    </DashboardShell>
  )
}
