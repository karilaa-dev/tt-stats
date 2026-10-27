import { stringify } from "csv-stringify/sync"

export interface HistoryCsvRow {
  Time: string
  Video: string
  Type?: "video" | "images" | "audio"
}

export function historyCsv(rows: HistoryCsvRow[]): string {
  return stringify(rows, {
    header: true,
    escape_formulas: true,
    columns: ["Time", "Video", "Type"],
  })
}

export function utcIsoFromEpoch(epoch: string | number): string {
  return new Date(Number(epoch) * 1000).toISOString()
}
