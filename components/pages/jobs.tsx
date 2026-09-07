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
      <DatabaseSetupCard
        status={setupQuery.data}
        checking={setupQuery.isPending || setupQuery.isFetching}
        controlsDisabled={fakeMode}
      />
      <VideoInactivityCard
        status={notificationStatus}
        monitorDatabaseStatus={getVideoMonitorDatabaseStatus({
          status: setupQuery.data,
          queryFailed: setupQuery.isError,
        })}
        fakeMode={fakeMode}
      />
      {setupQuery.isError && !setupQuery.data ? (
        <DashboardError
          error={setupQuery.error}
          reset={() => void setupQuery.refetch()}
        />
      ) : jobsQuery.isError && !jobsQuery.data ? (
        <DashboardError
          error={jobsQuery.error}
          reset={() => void jobsQuery.refetch()}
        />
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
      ) : canLoadJobs || fakeMode ? (
        <DashboardLoading />
      ) : null}
    </>
  )
}
