import { databaseAction } from "@/lib/tasks/action"
import { requestWithCooldown } from "@/lib/http-client"
import { actions } from "astro:actions"

export const getDashboardMeta = () =>
  requestWithCooldown("read", () => actions.getDashboardMeta.orThrow())

export const getSnapshotMetadata = (signal?: AbortSignal) =>
  databaseAction(actions.getSnapshotMetadata, undefined, signal)

export const getOverview = (signal?: AbortSignal) =>
  databaseAction(actions.getOverview, undefined, signal)

export const getStatsBreakdown = ({
  data,
  signal,
}: {
  data: Parameters<typeof actions.getStatsBreakdown>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getStatsBreakdown, data, signal)

export const getTimeSeries = ({
  data,
  signal,
}: {
  data: Parameters<typeof actions.getTimeSeries>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getTimeSeries, data, signal)

export const getReferralStats = (signal?: AbortSignal) =>
  databaseAction(actions.getReferralStats, undefined, signal)

export const getOtherStats = (signal?: AbortSignal) =>
  databaseAction(actions.getOtherStats, undefined, signal)

export const getUserStats = ({
  data,
  signal,
}: {
  data: Parameters<typeof actions.getUserStats>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getUserStats, data, signal)

export const getUserDownloads = ({
  data,
  signal,
}: {
  data: Parameters<typeof actions.getUserDownloads>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getUserDownloads, data, signal)

export const getStatsJobs = (signal?: AbortSignal) =>
  databaseAction(actions.getStatsJobs, undefined, signal)

export const getDatabaseSetupStatus = (signal?: AbortSignal) =>
  databaseAction(actions.getDatabaseSetupStatus, undefined, signal)

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
}: {
  data: Parameters<typeof actions.getStatsJobRuns>[0]
  signal?: AbortSignal
}) => databaseAction(actions.getStatsJobRuns, data, signal)

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
