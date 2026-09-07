import { actions } from "astro:actions"

export const getDashboardMeta = () => actions.getDashboardMeta.orThrow()

export const getSnapshotMetadata = () => actions.getSnapshotMetadata.orThrow()

export const getOverview = () => actions.getOverview.orThrow()

export const getStatsBreakdown = ({
  data,
}: {
  data: Parameters<typeof actions.getStatsBreakdown>[0]
}) => actions.getStatsBreakdown.orThrow(data)

export const getTimeSeries = ({
  data,
}: {
  data: Parameters<typeof actions.getTimeSeries>[0]
}) => actions.getTimeSeries.orThrow(data)

export const getReferralStats = () => actions.getReferralStats.orThrow()

export const getOtherStats = () => actions.getOtherStats.orThrow()

export const getUserStats = ({
  data,
}: {
  data: Parameters<typeof actions.getUserStats>[0]
}) => actions.getUserStats.orThrow(data)

export const getUserDownloads = ({
  data,
}: {
  data: Parameters<typeof actions.getUserDownloads>[0]
}) => actions.getUserDownloads.orThrow(data)

export const getStatsJobs = () => actions.getStatsJobs.orThrow()

export const getDatabaseSetupStatus = () =>
  actions.getDatabaseSetupStatus.orThrow()

export const configureDatabaseJobs = ({
  data,
}: {
  data: Parameters<typeof actions.configureDatabaseJobs>[0]
}) => actions.configureDatabaseJobs.orThrow(data)

export const updateDatabaseDefinitions = ({
  data,
}: {
  data: Parameters<typeof actions.updateDatabaseDefinitions>[0]
}) => actions.updateDatabaseDefinitions.orThrow(data)

export const getStatsJobRuns = ({
  data,
}: {
  data: Parameters<typeof actions.getStatsJobRuns>[0]
}) => actions.getStatsJobRuns.orThrow(data)

export const updateStatsJobSchedule = ({
  data,
}: {
  data: Parameters<typeof actions.updateStatsJobSchedule>[0]
}) => actions.updateStatsJobSchedule.orThrow(data)

export const setStatsJobActive = ({
  data,
}: {
  data: Parameters<typeof actions.setStatsJobActive>[0]
}) => actions.setStatsJobActive.orThrow(data)

export const requestStatsJobRun = ({
  data,
}: {
  data: Parameters<typeof actions.requestStatsJobRun>[0]
}) => actions.requestStatsJobRun.orThrow(data)

export const getManualRefreshRequest = ({
  data,
}: {
  data: Parameters<typeof actions.getManualRefreshRequest>[0]
}) => actions.getManualRefreshRequest.orThrow(data)
