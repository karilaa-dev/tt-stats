import {
  DashboardShell,
  type DashboardShellProps,
} from "@/components/dashboard/dashboard-shell"
import { VideosPage } from "./videos"

export default function PageIsland(
  props: Omit<DashboardShellProps, "children">
) {
  return (
    <DashboardShell {...props}>
      <VideosPage />
    </DashboardShell>
  )
}
