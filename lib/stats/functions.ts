import { databaseAction } from "@/lib/tasks/action"
import { requestWithCooldown } from "@/lib/http-client"
import { actions } from "astro:actions"

export const getDashboardMeta = () =>
  requestWithCooldown("read", () => actions.getDashboardMeta.orThrow())

// Public snapshot reads are short indexed reads behind a shared server cache.
// They keep request cancellation but show inline loading states only.
const quiet = { quiet: true }

export const getSnapshotMetadata = (signal?: AbortSignal) =>
  databaseAction(actions.getSnapshotMetadata, undefined, signal, quiet)

export const getOverview = (signal?: AbortSignal) =>
  databaseAction(actions.getOverview, undefined, signal, quiet)

export const getStatsBreakdown = ({
  data,
  signal,
}: {
  data: Parameters<typeof actions.getStatsBreakdown>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getStatsBreakdown, data, signal, quiet)

export const getTimeSeries = ({
  data,
  signal,
}: {
  data: Parameters<typeof actions.getTimeSeries>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getTimeSeries, data, signal, quiet)

export const getReferralStats = (signal?: AbortSignal) =>
  databaseAction(actions.getReferralStats, undefined, signal, quiet)

export const getOtherStats = (signal?: AbortSignal) =>
  databaseAction(actions.getOtherStats, undefined, signal, quiet)

export const getStatsJobs = (signal?: AbortSignal, background = false) =>
  databaseAction(actions.getStatsJobs, undefined, signal, {
    quiet: background,
  })

export const getDatabaseSetupStatus = (
  signal?: AbortSignal,
  background = false
) =>
  databaseAction(actions.getDatabaseSetupStatus, undefined, signal, {
    quiet: background,
  })

export const configureDatabaseJobs = ({
  data,
}: {
  data: Parameters<typeof actions.configureDatabaseJobs>[0]
}) =>
  requestWithCooldown("read", () => actions.configureDatabaseJobs.orThrow(data))

export const updateDatabaseDefinitions = ({
  data,
}: {
  data: Parameters<typeof actions.updateDatabaseDefinitions>[0]
}) =>
  requestWithCooldown("read", () =>
    actions.updateDatabaseDefinitions.orThrow(data)
  )

export const getStatsJobRuns = ({
  data,
  signal,
  background = false,
}: {
  data: Parameters<typeof actions.getStatsJobRuns>[0]
  signal?: AbortSignal
  background?: boolean
}) =>
  databaseAction(actions.getStatsJobRuns, data, signal, { quiet: background })

export const updateStatsJobSchedule = ({
  data,
}: {
  data: Parameters<typeof actions.updateStatsJobSchedule>[0]
}) =>
  requestWithCooldown("read", () =>
    actions.updateStatsJobSchedule.orThrow(data)
  )

export const setStatsJobActive = ({
  data,
}: {
  data: Parameters<typeof actions.setStatsJobActive>[0]
}) => requestWithCooldown("read", () => actions.setStatsJobActive.orThrow(data))

export const requestStatsJobRun = ({
  data,
}: {
  data: Parameters<typeof actions.requestStatsJobRun>[0]
}) =>
  requestWithCooldown("read", () => actions.requestStatsJobRun.orThrow(data))

export const getManualRefreshRequest = ({
  data,
}: {
  data: Parameters<typeof actions.getManualRefreshRequest>[0]
}) =>
  requestWithCooldown("read", () =>
    actions.getManualRefreshRequest.orThrow(data)
  )
