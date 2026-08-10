import { Suspense } from "react"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireSession } from "@/lib/auth/session"
import { currentEpochMilliseconds } from "@/lib/current-time"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <Skeleton className="h-64 w-full" />
        </DashboardShell>
      }
    >
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  )
}

async function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()
  return (
    <DashboardShell refreshedAt={currentEpochMilliseconds()}>
      {children}
    </DashboardShell>
  )
}

function DashboardShell({
  children,
  refreshedAt,
}: {
  children: React.ReactNode
  refreshedAt?: number
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader refreshedAt={refreshedAt} />
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
