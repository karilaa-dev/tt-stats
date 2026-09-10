import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import { AdminGate } from "@/components/dashboard/admin-access"
import { VideosPage } from "./videos"

export default function PageIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <AdminGate>
        <VideosPage />
      </AdminGate>
    </DashboardShell>
  )
}
