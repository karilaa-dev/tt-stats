import type { DatabaseErrorKind } from "@/lib/db/errors"

export interface DatabaseSetupStatus {
  appConnection: {
    ok: boolean
    errorKind: DatabaseErrorKind | null
  }
  databaseRole: {
    canCreate: boolean
    canCreateTemporaryTables: boolean
    canReadSourceTables: boolean
    canUseCron: boolean
    superuser: boolean
  }
  snapshot: {
    schemaInstalled: boolean
    tablesInstalled: boolean
    jobsApiInstalled: boolean
    definitionsCurrent: boolean
    appCanRead: boolean
    appCanManageJobs: boolean
    appCanMonitorDownloads: boolean
    rollingSeeded: boolean
    dailySeeded: boolean
  }
  scheduler: {
    pgCronInstalled: boolean
    pgCronVersion: string | null
    inspectable: boolean
    rollingJobInstalled: boolean
    dailyJobInstalled: boolean
  }
  ready: boolean
}

export interface ConfigureDatabaseJobsResult {
  queuedDatasets: Array<"rolling_24h" | "daily">
  warnings: string[]
}
