import { createFileRoute } from "@tanstack/react-router"

import { getHealthResponse } from "@/lib/health"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => getHealthResponse(),
    },
  },
})
