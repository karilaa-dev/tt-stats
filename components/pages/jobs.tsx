import { useDashboardContext } from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import { DatabaseZapIcon } from "lucide-react"

import { DatabaseSetupCard } from "@/components/dashboard/database-setup-card"
import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsJobCard } from "@/components/dashboard/stats-job-card"
import { VideoInactivityCard } from "@/components/dashboard/video-inactivity-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  databaseSetupQueryOptions,
  statsJobsQueryOptions,
} from "@/lib/stats/query-options"
import { getVideoNotificationStatus } from "@/lib/notifications/functions"
import { getVideoMonitorDatabaseStatus } from "@/lib/notifications/status"

export function DatabaseJobsPage() {
  const { fakeMode } = useDashboardContext()
  const notificationQuery = useQuery({
    queryKey: ["video-notification-status"],
    queryFn: getVideoNotificationStatus,
  })
  const notificationStatus = notificationQuery.data ?? {
    configured: false,
    provider: null,
    configurationError: false,
  }
  const setupQuery = useQuery(databaseSetupQueryOptions())
  const canLoadJobs = Boolean(
    setupQuery.data?.appConnection.ok &&
    setupQuery.data.snapshot.jobsApiInstalled &&
    setupQuery.data.snapshot.appCanManageJobs &&
    setupQuery.data.scheduler.pgCronInstalled &&
    setupQuery.data.scheduler.rollingJobInstalled &&
    setupQuery.data.scheduler.dailyJobInstalled
  )
  const jobsQuery = useQuery({
    ...statsJobsQueryOptions(),
    enabled: fakeMode || canLoadJobs,
  })

  return (
    <>
      <PageHeading
        title="Database jobs"
        description="Check database health and manage automatic statistics updates."
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
      <div className="flex flex-col gap-8">
        <section
          aria-labelledby="database-health-heading"
          className="grid items-start gap-5 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-8"
        >
          <div>
            <h2
              id="database-health-heading"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Database health
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Check the connection and required setup before changing schedules.
            </p>
          </div>
          <div className="min-w-0 [&>[data-slot=card]]:mb-0">
            <DatabaseSetupCard
              status={setupQuery.data}
              checking={setupQuery.isPending || setupQuery.isFetching}
              controlsDisabled={fakeMode}
            />
            {setupQuery.isError && !setupQuery.data ? (
              <DashboardError
                error={setupQuery.error}
                reset={() => void setupQuery.refetch()}
              />
            ) : null}
          </div>
        </section>
        <section
          aria-labelledby="refresh-schedules-heading"
          className="grid items-start gap-5 border-t pt-8 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-8"
        >
          <div>
            <h2
              id="refresh-schedules-heading"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Refresh schedules
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Review the latest runs, change a schedule, or request a fresh
              snapshot.
            </p>
          </div>
          <div className="min-w-0">
            {jobsQuery.isError && !jobsQuery.data ? (
              <DashboardError
                error={jobsQuery.error}
                reset={() => void jobsQuery.refetch()}
              />
            ) : jobsQuery.data ? (
              <div className="grid min-w-0 gap-6">
                {jobsQuery.data.map((job) => (
                  <StatsJobCard
                    key={job.dataset}
                    job={job}
                    controlsDisabled={fakeMode}
                  />
                ))}
              </div>
            ) : canLoadJobs || fakeMode ? (
              <DashboardLoading />
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
                Schedules will appear after the database connection, statistics
                setup, and scheduler checks pass above.
              </p>
            )}
          </div>
        </section>
        <section
          aria-labelledby="delivery-monitor-heading"
          className="grid items-start gap-5 border-t pt-8 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-8"
        >
          <div>
            <h2
              id="delivery-monitor-heading"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Delivery alerts
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Monitor interruptions in video deliveries and check notification
              settings.
            </p>
          </div>
          <div className="min-w-0 [&>[data-slot=card]]:mb-0">
            {notificationQuery.isError && !notificationQuery.data ? (
              <DashboardError
                error={notificationQuery.error}
                reset={() => void notificationQuery.refetch()}
              />
            ) : null}
            <VideoInactivityCard
              status={notificationStatus}
              monitorDatabaseStatus={getVideoMonitorDatabaseStatus({
                status: setupQuery.data,
                queryFailed: setupQuery.isError,
              })}
              fakeMode={fakeMode}
            />
          </div>
        </section>
      </div>
    </>
  )
}
