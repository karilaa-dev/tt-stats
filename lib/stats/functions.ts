import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
  getFakeOtherStats,
  getFakeOverview,
  getFakeReferralStats,
  getFakeSnapshotMetadata,
  getFakeStatsBreakdown,
  getFakeStatsJobs,
  getFakeTimeSeries,
  getFakeUserDownloads,
  getFakeUserStats,
  isFakeDataEnabled,
} from "@/lib/dev/fake-data"
import {
  configureDatabaseJobsRaw,
  getDatabaseSetupStatusRaw,
  updateDatabaseDefinitionsRaw,
} from "@/lib/stats/setup"
import type { DatabaseSetupStatus } from "@/lib/stats/setup-types"
import {
  getManualRefreshRequestRaw,
  getOtherStatsRaw,
  getOverviewRaw,
  getReferralStatsRaw,
  getSnapshotMetadataRaw,
  getStatsBreakdownRaw,
  getStatsJobRunsRaw,
  getStatsJobsRaw,
  getTimeSeriesRaw,
  getUserDownloadsRaw,
  getUserStatsRaw,
  requestStatsJobRunRaw,
  setStatsJobActiveRaw,
  updateStatsJobScheduleRaw,
} from "@/lib/stats/queries"
import {
  CHAT_SCOPES,
  SERIES_METRICS,
  STATS_DATASETS,
  STATS_RANGES,
} from "@/lib/stats/types"

const statsRange = z.enum(STATS_RANGES)
const chatScope = z.enum(CHAT_SCOPES)
const seriesMetric = z.enum(SERIES_METRICS)
const statsDataset = z.enum(STATS_DATASETS)
const telegramId = z.string().regex(/^-?\d+$/u)
const positivePage = z.number().int().positive()
const requestId = z.string().regex(/^\d+$/u)
const cronSchedule = z
  .string()
  .trim()
  .min(1, "Enter a cron schedule.")
  .max(100, "Cron schedules cannot exceed 100 characters.")
  .refine(
    (value) =>
      !Array.from(value).some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      }),
    {
      message: "Cron schedules cannot contain control characters.",
    }
  )

function fakeWriteError(): never {
  throw new Error(
    "Database job controls are disabled while fake data is active."
  )
}

function getFakeDatabaseSetupStatus(): DatabaseSetupStatus {
  return {
    appConnection: { ok: true, errorKind: null },
    databaseRole: {
      canCreate: true,
      canCreateTemporaryTables: true,
      canReadSourceTables: true,
      canUseCron: true,
      superuser: false,
    },
    snapshot: {
      schemaInstalled: true,
      tablesInstalled: true,
      jobsApiInstalled: true,
      definitionsCurrent: true,
      appCanRead: true,
      appCanManageJobs: true,
      rollingSeeded: true,
      dailySeeded: true,
    },
    scheduler: {
      pgCronInstalled: true,
      pgCronVersion: "demo",
      inspectable: true,
      rollingJobInstalled: true,
      dailyJobInstalled: true,
    },
    ready: true,
  }
}

export const getDashboardMeta = createServerFn({ method: "GET" }).handler(
  () => ({ fakeMode: isFakeDataEnabled() })
)

export const getSnapshotMetadata = createServerFn({ method: "GET" }).handler(
  () =>
    isFakeDataEnabled() ? getFakeSnapshotMetadata() : getSnapshotMetadataRaw()
)

export const getOverview = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeOverview() : getOverviewRaw()
)

export const getStatsBreakdown = createServerFn({ method: "GET" })
  .validator(z.object({ scope: chatScope, range: statsRange }))
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeStatsBreakdown(data.scope, data.range)
      : getStatsBreakdownRaw(data.scope, data.range)
  )

export const getTimeSeries = createServerFn({ method: "GET" })
  .validator(z.object({ metric: seriesMetric, range: statsRange }))
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeTimeSeries(data.metric, data.range)
      : getTimeSeriesRaw(data.metric, data.range)
  )

export const getReferralStats = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeReferralStats() : getReferralStatsRaw()
)

export const getOtherStats = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeOtherStats() : getOtherStatsRaw()
)

export const getUserStats = createServerFn({ method: "GET" })
  .validator(z.object({ userId: telegramId }))
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeUserStats(data.userId)
      : getUserStatsRaw(data.userId)
  )

export const getUserDownloads = createServerFn({ method: "GET" })
  .validator(
    z.object({
      userId: telegramId,
      page: positivePage,
      pageSize: positivePage.max(50),
    })
  )
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeUserDownloads(data.userId, data.page, data.pageSize)
      : getUserDownloadsRaw(data.userId, data.page, data.pageSize)
  )

export const getStatsJobs = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeStatsJobs() : getStatsJobsRaw()
)

export const getDatabaseSetupStatus = createServerFn({ method: "GET" }).handler(
  () =>
    isFakeDataEnabled()
      ? getFakeDatabaseSetupStatus()
      : getDatabaseSetupStatusRaw()
)

export const configureDatabaseJobs = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rollingSchedule: cronSchedule,
      dailySchedule: cronSchedule,
      setupPrivilegesConfirmed: z.literal(true, {
        error: "Confirm that DB_URL has the listed non-superuser grants.",
      }),
    })
  )
  .handler(async ({ data }) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      return await configureDatabaseJobsRaw(data)
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error(
        "Database setup failed safely. No existing snapshots or schedules were deleted."
      )
    }
  })

export const updateDatabaseDefinitions = createServerFn({ method: "POST" })
  .validator(
    z.object({
      setupPrivilegesConfirmed: z.literal(true, {
        error: "Confirm that DB_URL owns the installed TT Stats schema.",
      }),
    })
  )
  .handler(async ({ data }) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      return await updateDatabaseDefinitionsRaw(data)
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error(
        "Database definitions could not be updated. Existing snapshots and schedules were left unchanged."
      )
    }
  })

export const getStatsJobRuns = createServerFn({ method: "GET" })
  .validator(
    z.object({ dataset: statsDataset, limit: z.number().int().min(1).max(50) })
  )
  .handler(({ data }) =>
    isFakeDataEnabled() ? [] : getStatsJobRunsRaw(data.dataset, data.limit)
  )

export const updateStatsJobSchedule = createServerFn({ method: "POST" })
  .validator(z.object({ dataset: statsDataset, schedule: cronSchedule }))
  .handler(async ({ data }) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      await updateStatsJobScheduleRaw(data.dataset, data.schedule)
      return { schedule: data.schedule }
    } catch {
      throw new Error(
        "PostgreSQL rejected that cron schedule. The previous schedule is unchanged."
      )
    }
  })

export const setStatsJobActive = createServerFn({ method: "POST" })
  .validator(z.object({ dataset: statsDataset, active: z.boolean() }))
  .handler(async ({ data }) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      await setStatsJobActiveRaw(data.dataset, data.active)
      return { active: data.active }
    } catch {
      throw new Error(
        `PostgreSQL could not ${data.active ? "resume" : "pause"} this fixed job. Its previous state is unchanged.`
      )
    }
  })

export const requestStatsJobRun = createServerFn({ method: "POST" })
  .validator(z.object({ dataset: statsDataset }))
  .handler(async ({ data }) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      return { requestId: await requestStatsJobRunRaw(data.dataset) }
    } catch {
      throw new Error(
        "PostgreSQL could not queue the refresh. Check that pg_cron is active and the job-management grants are installed."
      )
    }
  })

export const getManualRefreshRequest = createServerFn({ method: "GET" })
  .validator(z.object({ requestId }))
  .handler(({ data }) =>
    isFakeDataEnabled() ? null : getManualRefreshRequestRaw(data.requestId)
  )
