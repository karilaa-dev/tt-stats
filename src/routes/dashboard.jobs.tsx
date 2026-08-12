import { useQuery } from "@tanstack/react-query"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { DatabaseZapIcon } from "lucide-react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsJobCard } from "@/components/dashboard/stats-job-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { statsJobsQueryOptions } from "@/lib/stats/query-options"

export const Route = createFileRoute("/dashboard/jobs")({
  head: () => ({ meta: [{ title: "Database jobs · TT Stats" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(statsJobsQueryOptions())
  },
  component: DatabaseJobsPage,
})

function DatabaseJobsPage() {
  const { fakeMode } = getRouteApi("/dashboard").useLoaderData()
  const jobsQuery = useQuery(statsJobsQueryOptions())

  return (
    <>
      <PageHeading
        title="Database jobs"
        description="Manage the two fixed PostgreSQL snapshot jobs without exposing arbitrary SQL or unrelated cron jobs."
      />
      {fakeMode ? (
        <Alert className="mb-6">
          <DatabaseZapIcon />
          <AlertTitle>Controls disabled in fake-data mode</AlertTitle>
          <AlertDescription>
            The cards below are representative. Connect PostgreSQL and pg_cron
            to manage real schedules.
          </AlertDescription>
        </Alert>
      ) : null}
      {jobsQuery.isError && !jobsQuery.data ? (
        <DashboardError reset={() => void jobsQuery.refetch()} />
      ) : jobsQuery.data ? (
        <div className="grid min-w-0 gap-6 2xl:grid-cols-2">
          {jobsQuery.data.map((job) => (
            <StatsJobCard
              key={job.dataset}
              job={job}
              controlsDisabled={fakeMode}
            />
          ))}
        </div>
      ) : (
        <DashboardLoading />
      )}
    </>
  )
}
