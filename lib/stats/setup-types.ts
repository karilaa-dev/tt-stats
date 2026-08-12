import type { DatabaseErrorKind } from "@/lib/db/errors"

export interface DatabaseSetupStatus {
  appConnection: {
    ok: boolean
    errorKind: DatabaseErrorKind | null
  }
  installerConnection: {
    configured: boolean
    ok: boolean
    sameDatabase: boolean
    canCreate: boolean
    superuser: boolean
    errorKind: DatabaseErrorKind | null
  }
  snapshot: {
    schemaInstalled: boolean
    tablesInstalled: boolean
    jobsApiInstalled: boolean
    appCanRead: boolean
    appCanManageJobs: boolean
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
