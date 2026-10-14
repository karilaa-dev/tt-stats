/**
 * A query that already shows data refreshes in the background; only a first
 * load may open the database progress dialog.
 */
export function isBackgroundRefresh(context: {
  client: { getQueryData: (key: readonly unknown[]) => unknown }
  queryKey: readonly unknown[]
}) {
  return context.client.getQueryData(context.queryKey) !== undefined
}
