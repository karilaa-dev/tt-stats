import type { DatabaseSetupStatus } from "@/lib/stats/setup-types"

export type VideoMonitorDatabaseStatus =
  | "checking"
  | "unavailable"
  | "install"
  | "definitions"
  | "permissions"
  | "ready"

export function getVideoMonitorDatabaseStatus({
  status,
  queryFailed = false,
}: {
  status?: DatabaseSetupStatus
  queryFailed?: boolean
}): VideoMonitorDatabaseStatus {
  if (queryFailed) return "unavailable"
  if (!status) return "checking"
  if (!status.appConnection.ok) return "unavailable"
  if (
    !status.snapshot.schemaInstalled ||
    !status.snapshot.tablesInstalled ||
    !status.snapshot.jobsApiInstalled
  ) {
    return "install"
  }
  if (!status.snapshot.definitionsCurrent) return "definitions"
  if (!status.snapshot.appCanMonitorDownloads) return "permissions"
  return "ready"
}
