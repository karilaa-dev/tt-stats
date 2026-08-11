import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"

import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import styles from "../styles.css?url"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TT Stats" },
      { name: "description", content: "Analytics for tt-bot." },
    ],
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <Outlet />
          </TooltipProvider>
          <Toaster richColors closeButton />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button nativeButton={false} render={<Link to="/dashboard" />}>
        Return to dashboard
      </Button>
    </main>
  )
}
