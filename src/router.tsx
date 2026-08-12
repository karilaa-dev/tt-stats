import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { isSafeDatabaseError } from "@/lib/db/errors"

import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        // These messages are deliberately allowlisted and contain no database
        // identifiers. Keep them through pending SSR hydration so production
        // can explain a missing schema or grant; redact every other error.
        shouldRedactErrors: (error) => !isSafeDatabaseError(error),
      },
      queries: {
        gcTime: 60 * 60 * 1000,
        networkMode: "offlineFirst",
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
