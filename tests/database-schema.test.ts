import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("database schema", () => {
  it("installs monitor state without reading source tables", async () => {
    const schema = await readFile(
      new URL("../database/001_stats_snapshot_schema.sql", import.meta.url),
      "utf8"
    )
    const monitorStart = schema.indexOf(
      "CREATE TABLE IF NOT EXISTS tt_stats_cache.video_inactivity_monitor"
    )
    const nextDefinition = schema.indexOf(
      "CREATE INDEX IF NOT EXISTS tt_stats_manual_refresh_requested_idx",
      monitorStart
    )
    const monitorDefinition = schema.slice(monitorStart, nextDefinition)

    expect(monitorStart).toBeGreaterThanOrEqual(0)
    expect(nextDefinition).toBeGreaterThan(monitorStart)
    expect(monitorDefinition).toContain("VALUES (TRUE, NULL)")
    expect(monitorDefinition).not.toContain("public.videos")
  })
})
