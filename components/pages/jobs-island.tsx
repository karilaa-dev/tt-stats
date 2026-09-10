import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import { DatabaseJobsPage } from "./jobs"
import { AdminGate } from "@/components/dashboard/admin-access"

export default function PageIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <AdminGate>
        <DatabaseJobsPage />
      </AdminGate>
    </DashboardShell>
  )
}
