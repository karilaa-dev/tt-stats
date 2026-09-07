import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
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
          <MotionConfig reducedMotion="user">
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
                    className="dashboard-main mx-auto flex w-full max-w-screen-2xl flex-1 flex-col p-4 md:p-6 lg:p-8"
                    tabIndex={-1}
                  >
                    {children}
                  </main>
                  <footer className="dashboard-footer">
                    TT Stats <span>tt-bot analytics</span>
                  </footer>
                </SidebarInset>
              </SidebarProvider>
              <Toaster richColors closeButton />
            </TooltipProvider>
          </MotionConfig>
        </ThemeProvider>
      </DashboardContext.Provider>
    </QueryClientProvider>
  )
}
