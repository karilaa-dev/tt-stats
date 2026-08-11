import { createFileRoute } from "@tanstack/react-router"

import { getHistoryCsvResponse } from "@/lib/csv/history"

export const Route = createFileRoute("/api/users/$userId/history.csv")({
  server: {
    handlers: {
      GET: ({ params }) => getHistoryCsvResponse(params.userId),
    },
  },
})
