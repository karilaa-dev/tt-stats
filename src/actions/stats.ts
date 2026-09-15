import { getPrincipal } from "@/lib/auth/session"
import {
  getCachedUserStats,
  getCachedUserDownloads,
  getCachedUserActivity,
} from "@/lib/stats/cached"
import { parseTelegramId } from "@/lib/stats/validation"
import { defineAction, ActionError } from "astro:actions"
import { getSafeDatabaseError } from "@/lib/db/errors"
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
  getFakeUserActivity,
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
  requestStatsJobRunRaw,
  setStatsJobActiveRaw,
  updateStatsJobScheduleRaw,
} from "@/lib/stats/queries"
import {
  CHAT_SCOPES,
  SERIES_METRICS,
  STATS_DATASETS,
  STATS_RANGES,
  USER_ACTIVITY_RANGES,
} from "@/lib/stats/types"

const statsRange = z.enum(STATS_RANGES)
const chatScope = z.enum(CHAT_SCOPES)
const seriesMetric = z.enum(SERIES_METRICS)
const statsDataset = z.enum(STATS_DATASETS)
const telegramId = z
  .string()
  .max(20)
  .refine((value) => parseTelegramId(value) !== null)
  .transform((value) => parseTelegramId(value)!)
const positivePage = z.number().int().positive().max(1_000_000)
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
  throw new ActionError({
    code: "BAD_REQUEST",
    message: "Database job controls are disabled while fake data is active.",
  })
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
      appCanMonitorDownloads: true,
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
    website: { ready: true },
    ready: true,
  }
}

export const getDashboardMeta = defineAction({
  handler: safeHandler(() => ({ fakeMode: isFakeDataEnabled() })),
})

export const getSnapshotMetadata = defineAction({
  handler: safeHandler(() =>
    isFakeDataEnabled() ? getFakeSnapshotMetadata() : getSnapshotMetadataRaw()
  ),
})

export const getOverview = defineAction({
  handler: safeHandler(() =>
    isFakeDataEnabled() ? getFakeOverview() : getOverviewRaw()
  ),
})

export const getStatsBreakdown = defineAction({
  input: z.object({ scope: chatScope, range: statsRange }),
  handler: safeHandler((data) =>
    isFakeDataEnabled()
      ? getFakeStatsBreakdown(data.scope, data.range)
      : getStatsBreakdownRaw(data.scope, data.range)
  ),
})

export const getTimeSeries = defineAction({
  input: z.object({ metric: seriesMetric, range: statsRange }),
  handler: safeHandler((data) =>
    isFakeDataEnabled()
      ? getFakeTimeSeries(data.metric, data.range)
      : getTimeSeriesRaw(data.metric, data.range)
  ),
})

export const getReferralStats = defineAction({
  handler: safeHandler(() =>
    isFakeDataEnabled() ? getFakeReferralStats() : getReferralStatsRaw()
  ),
})

export const getOtherStats = defineAction({
  handler: async (_input, context) => {
    const data = await safeHandler(() =>
      isFakeDataEnabled() ? getFakeOtherStats() : getOtherStatsRaw()
    )(undefined)
    return {
      ...data,
      topDownloaders: (await getPrincipal(context.cookies)).admin
        ? data.topDownloaders
        : [],
    }
  },
})

const historyFilters = {
  savedMediaOnly: z.boolean().default(false),
  from: z.number().int().min(0).max(253402300800).optional(),
  until: z.number().int().min(0).max(253402300800).optional(),
  mediaKind: z.enum(["all", "video", "images"]).default("all"),
  discovery: z.enum(["all", "others", "first"]).default("all"),
  sort: z.enum(["newest", "popular"]).default("newest"),
}
const validHistoryRange = (data: { from?: number; until?: number }) =>
  data.from === undefined || data.until === undefined || data.from < data.until
const historyRangeError = {
  message: "The end must be after the start.",
  path: ["until"],
}
export const getMyActivity = defineAction({
  input: z.object({ range: z.enum(USER_ACTIVITY_RANGES) }).strict(),
  handler: async ({ range }, context) => {
    const user = (await getPrincipal(context.cookies)).user
    if (!user)
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Log in with Telegram to continue.",
      })
    return safeHandler(() =>
      isFakeDataEnabled()
        ? getFakeUserActivity(user.id, range)
        : getCachedUserActivity(user.id, range)
    )(undefined)
  },
})
export const getUserActivity = defineAction({
  input: z
    .object({ userId: telegramId, range: z.enum(USER_ACTIVITY_RANGES) })
    .strict(),
  handler: async ({ userId, range }, context) => {
    if (!(await getPrincipal(context.cookies)).admin)
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Admin access required.",
      })
    return safeHandler(() =>
      isFakeDataEnabled()
        ? getFakeUserActivity(userId, range)
        : getCachedUserActivity(userId, range)
    )(undefined)
  },
})
export const getMyStats = defineAction({
  handler: async (_input, context) => {
    const user = (await getPrincipal(context.cookies)).user
    if (!user)
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Log in with Telegram to continue.",
      })
    return safeHandler(() =>
      isFakeDataEnabled()
        ? getFakeUserStats(user.id)
        : getCachedUserStats(user.id)
    )(undefined)
  },
})
export const getMyDownloads = defineAction({
  input: z
    .object({
      page: positivePage,
      pageSize: positivePage.max(50),
      ...historyFilters,
    })
    .strict()
    .refine(validHistoryRange, historyRangeError),
  handler: async (data, context) => {
    const user = (await getPrincipal(context.cookies)).user
    if (!user)
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "Log in with Telegram to continue.",
      })
    return safeHandler(() =>
      isFakeDataEnabled()
        ? getFakeUserDownloads(user.id, data.page, data.pageSize, data)
        : getCachedUserDownloads(
            user.id,
            data.page,
            data.pageSize,
            undefined,
            data
          )
    )(undefined)
  },
})

export const getUserStats = defineAction({
  input: z.object({ userId: telegramId }),
  handler: safeHandler((data) =>
    isFakeDataEnabled()
      ? getFakeUserStats(data.userId)
      : getCachedUserStats(data.userId)
  ),
})

export const getUserDownloads = defineAction({
  input: z
    .object({
      userId: telegramId,
      page: positivePage,
      pageSize: positivePage.max(50),
      ...historyFilters,
    })
    .strict()
    .refine(validHistoryRange, historyRangeError),
  handler: safeHandler((data) =>
    isFakeDataEnabled()
      ? getFakeUserDownloads(data.userId, data.page, data.pageSize, data)
      : getCachedUserDownloads(
          data.userId,
          data.page,
          data.pageSize,
          undefined,
          data
        )
  ),
})

export const getStatsJobs = defineAction({
  handler: safeHandler(() =>
    isFakeDataEnabled() ? getFakeStatsJobs() : getStatsJobsRaw()
  ),
})

export const getDatabaseSetupStatus = defineAction({
  handler: safeHandler(() =>
    isFakeDataEnabled()
      ? getFakeDatabaseSetupStatus()
      : getDatabaseSetupStatusRaw()
  ),
})

export const configureDatabaseJobs = defineAction({
  input: z.object({
    rollingSchedule: cronSchedule,
    dailySchedule: cronSchedule,
    setupPrivilegesConfirmed: z.literal(true, {
      error: "Confirm that DB_URL has the listed administrative privileges.",
    }),
  }),
  handler: safeHandler(async (data) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      return await configureDatabaseJobsRaw(data)
    } catch (error) {
      if (error instanceof Error) throw error
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "Database setup failed safely. No existing snapshots or schedules were deleted.",
      })
    }
  }),
})

export const updateDatabaseDefinitions = defineAction({
  input: z.object({
    setupPrivilegesConfirmed: z.literal(true, {
      error:
        "Confirm that DB_URL can update the installed @ttgrab Stats schema.",
    }),
  }),
  handler: safeHandler(async (data) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      return await updateDatabaseDefinitionsRaw(data)
    } catch (error) {
      if (error instanceof Error) throw error
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "Database definitions could not be updated. Existing snapshots and schedules were left unchanged.",
      })
    }
  }),
})

export const getStatsJobRuns = defineAction({
  input: z.object({
    dataset: statsDataset,
    limit: z.number().int().min(1).max(50),
  }),
  handler: safeHandler((data) =>
    isFakeDataEnabled() ? [] : getStatsJobRunsRaw(data.dataset, data.limit)
  ),
})

export const updateStatsJobSchedule = defineAction({
  input: z.object({ dataset: statsDataset, schedule: cronSchedule }),
  handler: safeHandler(async (data) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      await updateStatsJobScheduleRaw(data.dataset, data.schedule)
      return { schedule: data.schedule }
    } catch {
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "PostgreSQL rejected that cron schedule. The previous schedule is unchanged.",
      })
    }
  }),
})

export const setStatsJobActive = defineAction({
  input: z.object({ dataset: statsDataset, active: z.boolean() }),
  handler: safeHandler(async (data) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      await setStatsJobActiveRaw(data.dataset, data.active)
      return { active: data.active }
    } catch {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: `PostgreSQL could not ${data.active ? "resume" : "pause"} this fixed job. Its previous state is unchanged.`,
      })
    }
  }),
})

export const requestStatsJobRun = defineAction({
  input: z.object({ dataset: statsDataset }),
  handler: safeHandler(async (data) => {
    if (isFakeDataEnabled()) fakeWriteError()
    try {
      return { requestId: await requestStatsJobRunRaw(data.dataset) }
    } catch {
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "PostgreSQL could not queue the refresh. Check that pg_cron is active and the job-management grants are installed.",
      })
    }
  }),
})

export const getManualRefreshRequest = defineAction({
  input: z.object({ requestId }),
  handler: safeHandler((data) =>
    isFakeDataEnabled() ? null : getManualRefreshRequestRaw(data.requestId)
  ),
})

function safeHandler<Input, Output>(handler: (input: Input) => Output) {
  return async (input: Input) => {
    try {
      return await handler(input)
    } catch (error) {
      if (error instanceof ActionError) throw error
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: getSafeDatabaseError(error).description,
      })
    }
  }
}
