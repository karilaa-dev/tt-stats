export const DATABASE_ERROR_COPY = {
  connection: {
    title: "PostgreSQL cannot be reached",
    description:
      "The web process could not open a database connection. Check DB_URL, the database port, and network access.",
  },
  configuration: {
    title: "Database configuration is invalid",
    description:
      "The database connection setting is missing or malformed. Check the server environment and restart the web process.",
  },
  snapshotSchema: {
    title: "TT Stats database objects are not installed",
    description:
      "PostgreSQL is reachable, but the snapshot schema or its read API is missing. Open Database jobs to install or repair it.",
  },
  snapshotsMissing: {
    title: "Statistics snapshots are not ready",
    description:
      "The TT Stats schema exists, but its initial rolling or daily refresh has not completed. Check the queued refreshes under Database jobs.",
  },
  snapshotData: {
    title: "Statistics snapshot needs repair",
    description:
      "The stored chart snapshot is invalid. Open Database jobs, update the database definitions, then run the affected snapshot job.",
  },
  permission: {
    title: "Database permissions are incomplete",
    description:
      "PostgreSQL is reachable, but the application role cannot read TT Stats snapshots or execute the approved job functions.",
  },
  timeout: {
    title: "The database query timed out",
    description:
      "PostgreSQL did not finish the request in time. Existing snapshots remain unchanged; retry after checking database load.",
  },
  unavailable: {
    title: "Statistics could not be loaded",
    description:
      "PostgreSQL returned an unexpected error. Retry the request, then check Database jobs for setup diagnostics.",
  },
} as const

export type DatabaseErrorKind = keyof typeof DATABASE_ERROR_COPY

function findSafeDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  return Object.entries(DATABASE_ERROR_COPY).find(
    ([, copy]) => copy.description === message
  ) as
    | [DatabaseErrorKind, (typeof DATABASE_ERROR_COPY)[DatabaseErrorKind]]
    | undefined
}

export function isSafeDatabaseError(error: unknown): boolean {
  return Boolean(findSafeDatabaseError(error))
}

export function getSafeDatabaseError(error: unknown): {
  kind: DatabaseErrorKind
  title: string
  description: string
} {
  const entry = findSafeDatabaseError(error)
  const [kind, copy] = entry ?? ["unavailable", DATABASE_ERROR_COPY.unavailable]
  return { kind, ...copy }
}
