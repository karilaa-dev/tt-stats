import { T } from "@/lib/i18n/provider"
import { LocaleProvider } from "@/lib/i18n/provider"
import type { Locale } from "@/lib/i18n/locale"
import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/controls"
import { Toaster } from "@/components/controls/toast"
import { AppSidebar } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"
import { DashboardContext } from "@/lib/dashboard-context"
import { AdminProvider } from "./admin-access"
import { DatabaseProgress } from "./database-progress"

export interface DashboardShellProps {
  locale?: Locale
  pathname: string
  search: string
  fakeMode: boolean
  children: ReactNode
}
export function DashboardShell({ children, ...context }: DashboardShellProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  )
  return (
    <LocaleProvider initialLocale={context.locale}>
      <QueryClientProvider client={queryClient}>
        <DashboardContext.Provider value={context}>
          <TooltipProvider>
            <AdminProvider>
              <div className="workspace-layout">
                <a className="skip-link" href="#main-content">
                  <T>{"Skip to content"}</T>
                </a>
                <AppSidebar />
                <div className="workspace-content">
                  <DashboardHeader fakeMode={context.fakeMode} />
                  <main
                    id="main-content"
                    className="dashboard-main"
                    tabIndex={-1}
                  >
                    <T>{children}</T>
                  </main>
                  <footer className="dashboard-footer">
                    <span>
                      <T>{"@ttgrab Stats"}</T>
                    </span>
                  </footer>
                </div>
              </div>
              <Toaster />
              <DatabaseProgress />
            </AdminProvider>
          </TooltipProvider>
        </DashboardContext.Provider>
      </QueryClientProvider>
    </LocaleProvider>
  )
}
