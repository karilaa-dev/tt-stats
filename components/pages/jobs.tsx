import { T, useTranslation } from "@/lib/i18n/provider"
import { useDashboardContext } from "@/lib/dashboard-context"
import { useQuery } from "@tanstack/react-query"
import { DatabaseZapIcon } from "lucide-react"

import { DatabaseSetupCard } from "@/components/dashboard/database-setup-card"
import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageHeading } from "@/components/dashboard/page-heading"
import { StatsJobCard } from "@/components/dashboard/stats-job-card"
import { VideoInactivityCard } from "@/components/dashboard/video-inactivity-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/controls"
import {
  databaseSetupQueryOptions,
  statsJobsQueryOptions,
} from "@/lib/stats/query-options"
import { getVideoNotificationStatus } from "@/lib/notifications/functions"
import { getVideoMonitorDatabaseStatus } from "@/lib/notifications/status"

export function DatabaseJobsPage() {
  const { t } = useTranslation()

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
        title={t("Database jobs")}
        description={t(
          "Check database health and manage automatic statistics updates."
        )}
      />
      <T>
        {fakeMode ? (
          <Alert className="mb-6">
            <DatabaseZapIcon />
            <AlertTitle>
              <T>{"Controls disabled in fake-data mode"}</T>
            </AlertTitle>
            <AlertDescription>
              <T>
                {
                  "The cards below are representative. Connect PostgreSQL and pg_cron to manage real schedules."
                }
              </T>
            </AlertDescription>
          </Alert>
        ) : null}
      </T>
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
              <T>{"Database health"}</T>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <T>
                {
                  "Check the connection and required setup before changing schedules."
                }
              </T>
            </p>
          </div>
          <div className="min-w-0 [&>[data-slot=card]]:mb-0">
            <DatabaseSetupCard
              status={setupQuery.data}
              checking={setupQuery.isPending || setupQuery.isFetching}
              controlsDisabled={fakeMode}
            />
            <T>
              {setupQuery.isError && !setupQuery.data ? (
                <DashboardError
                  error={setupQuery.error}
                  reset={() => void setupQuery.refetch()}
                />
              ) : null}
            </T>
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
              <T>{"Refresh schedules"}</T>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <T>
                {
                  "Review the latest runs, change a schedule, or request a fresh snapshot."
                }
              </T>
            </p>
          </div>
          <div className="min-w-0">
            <T>
              {jobsQuery.isError && !jobsQuery.data ? (
                <DashboardError
                  error={jobsQuery.error}
                  reset={() => void jobsQuery.refetch()}
                />
              ) : jobsQuery.data ? (
                <div className="grid min-w-0 gap-6">
                  <T>
                    {jobsQuery.data.map((job) => (
                      <StatsJobCard
                        key={job.dataset}
                        job={job}
                        controlsDisabled={fakeMode}
                      />
                    ))}
                  </T>
                </div>
              ) : canLoadJobs || fakeMode ? (
                <DashboardLoading />
              ) : (
                <p className="rounded-2xl border border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
                  <T>
                    {
                      "Schedules will appear after the database connection, statistics setup, and scheduler checks pass above."
                    }
                  </T>
                </p>
              )}
            </T>
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
              <T>{"Delivery alerts"}</T>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <T>
                {
                  "Monitor interruptions in video deliveries and check notification settings."
                }
              </T>
            </p>
          </div>
          <div className="min-w-0 [&>[data-slot=card]]:mb-0">
            <T>
              {notificationQuery.isError && !notificationQuery.data ? (
                <DashboardError
                  error={notificationQuery.error}
                  reset={() => void notificationQuery.refetch()}
                />
              ) : null}
            </T>
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
