import { Outlet, createFileRoute } from "@tanstack/react-router"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getDashboardMeta } from "@/lib/stats/functions"

export const Route = createFileRoute("/dashboard")({
  loader: () => getDashboardMeta(),
  component: DashboardLayout,
  errorComponent: DashboardError,
})

function DashboardLayout() {
  const { refreshedAt, fakeMode } = Route.useLoaderData()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader refreshedAt={refreshedAt} fakeMode={fakeMode} />
        <div className="flex flex-1 flex-col p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
