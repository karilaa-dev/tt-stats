import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"
import { DashboardContext } from "@/lib/dashboard-context"

export interface DashboardShellProps {
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
            retry: 1,
          },
        },
      })
  )
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContext.Provider value={context}>
        <ThemeProvider>
          <TooltipProvider>
            <SidebarProvider>
              <a className="skip-link" href="#main-content">
                Skip to content
              </a>
              <AppSidebar />
              <SidebarInset>
                <DashboardHeader fakeMode={context.fakeMode} />
                <main
                  id="main-content"
                  className="dashboard-main"
                  tabIndex={-1}
                >
                  {children}
                </main>
                <footer className="dashboard-footer">
                  <span>tt stats /</span>
                  <span>Made for the people behind the bot.</span>
                </footer>
              </SidebarInset>
            </SidebarProvider>
            <Toaster richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </DashboardContext.Provider>
    </QueryClientProvider>
  )
}
