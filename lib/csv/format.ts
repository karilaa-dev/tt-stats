import { stringify } from "csv-stringify/sync"

export interface HistoryCsvRow {
  Time: string
  Video: string
}

export function historyCsv(rows: HistoryCsvRow[]): string {
  return stringify(rows, { header: true, columns: ["Time", "Video"] })
}

export function utcIsoFromEpoch(epoch: string | number): string {
  return new Date(Number(epoch) * 1000).toISOString()
}
