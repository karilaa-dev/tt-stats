import { requestWithCooldown } from "@/lib/http-client"
import { actions } from "astro:actions"

export const getDashboardMeta = () =>
  requestWithCooldown("read", () => actions.getDashboardMeta.orThrow())

export const getSnapshotMetadata = () =>
  requestWithCooldown("read", () => actions.getSnapshotMetadata.orThrow())

export const getOverview = () =>
  requestWithCooldown("read", () => actions.getOverview.orThrow())

export const getStatsBreakdown = ({
  data,
}: {
  data: Parameters<typeof actions.getStatsBreakdown>[0]
}) => requestWithCooldown("read", () => actions.getStatsBreakdown.orThrow(data))

export const getTimeSeries = ({
  data,
}: {
  data: Parameters<typeof actions.getTimeSeries>[0]
}) => requestWithCooldown("read", () => actions.getTimeSeries.orThrow(data))

export const getReferralStats = () =>
  requestWithCooldown("read", () => actions.getReferralStats.orThrow())

export const getOtherStats = () =>
  requestWithCooldown("read", () => actions.getOtherStats.orThrow())

export const getUserStats = ({
  data,
}: {
  data: Parameters<typeof actions.getUserStats>[0]
}) => requestWithCooldown("read", () => actions.getUserStats.orThrow(data))

export const getUserDownloads = ({
  data,
}: {
  data: Parameters<typeof actions.getUserDownloads>[0]
}) => requestWithCooldown("read", () => actions.getUserDownloads.orThrow(data))

export const getStatsJobs = () =>
  requestWithCooldown("read", () => actions.getStatsJobs.orThrow())

export const getDatabaseSetupStatus = () =>
  requestWithCooldown("read", () => actions.getDatabaseSetupStatus.orThrow())

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
}: {
  data: Parameters<typeof actions.getStatsJobRuns>[0]
}) => requestWithCooldown("read", () => actions.getStatsJobRuns.orThrow(data))

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
