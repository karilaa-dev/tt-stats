import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import { DetailedPage } from "./detailed"

export default function PageIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <DetailedPage />
    </DashboardShell>
  )
}
