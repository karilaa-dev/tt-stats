import { describe, expect, it } from "vitest"

import { getVideoMonitorDatabaseStatus } from "@/lib/notifications/status"
import type { DatabaseSetupStatus } from "@/lib/stats/setup-types"

const readyStatus: DatabaseSetupStatus = {
  appConnection: { ok: true, errorKind: null },
  databaseRole: {
    canCreate: false,
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
    pgCronVersion: "1.6",
    inspectable: true,
    rollingJobInstalled: true,
    dailyJobInstalled: true,
  },
  ready: true,
}

describe("video monitor database status", () => {
  it("distinguishes loading and failed setup queries", () => {
    expect(getVideoMonitorDatabaseStatus({})).toBe("checking")
    expect(getVideoMonitorDatabaseStatus({ queryFailed: true })).toBe(
      "unavailable"
    )
    expect(
      getVideoMonitorDatabaseStatus({
        status: readyStatus,
        queryFailed: true,
      })
    ).toBe("unavailable")
  })

  it("does not recommend an update for a disconnected database", () => {
    expect(
      getVideoMonitorDatabaseStatus({
        status: {
          ...readyStatus,
          appConnection: { ok: false, errorKind: "connection" },
        },
      })
    ).toBe("unavailable")
  })

  it("distinguishes a fresh install from stale definitions", () => {
    expect(
      getVideoMonitorDatabaseStatus({
        status: {
          ...readyStatus,
          snapshot: {
            ...readyStatus.snapshot,
            schemaInstalled: false,
            tablesInstalled: false,
            jobsApiInstalled: false,
            definitionsCurrent: false,
            appCanMonitorDownloads: false,
          },
        },
      })
    ).toBe("install")
    expect(
      getVideoMonitorDatabaseStatus({
        status: {
          ...readyStatus,
          snapshot: {
            ...readyStatus.snapshot,
            definitionsCurrent: false,
            appCanMonitorDownloads: false,
          },
        },
      })
    ).toBe("definitions")
  })

  it("requires complete monitor permissions before reporting ready", () => {
    expect(
      getVideoMonitorDatabaseStatus({
        status: {
          ...readyStatus,
          snapshot: {
            ...readyStatus.snapshot,
            appCanMonitorDownloads: false,
          },
        },
      })
    ).toBe("permissions")
    expect(getVideoMonitorDatabaseStatus({ status: readyStatus })).toBe("ready")
  })
})
