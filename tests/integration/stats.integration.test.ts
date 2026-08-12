import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { Pool } from "pg"

import { getHistoryCsvResponse } from "@/lib/csv/history"
import { getPool } from "@/lib/db/pool"

import {
  getBotstatUserIdsRaw,
  getOtherStatsRaw,
  getOverviewRaw,
  getReferralStatsRaw,
  getManualRefreshRequestRaw,
  getStatsBreakdownRaw,
  getStatsJobsRaw,
  getTimeSeriesRaw,
  getUserDownloadsRaw,
  getUserStatsRaw,
  requestStatsJobRunRaw,
  setStatsJobActiveRaw,
  updateStatsJobScheduleRaw,
} from "@/lib/stats/queries"

const run = process.env.RUN_DATABASE_INTEGRATION === "1"
const runPgCron = process.env.RUN_PG_CRON_INTEGRATION === "1"
const integration = describe.runIf(run)
const now = 2_000_074_937
const windowEnd = Math.floor(now / 3600) * 3600
let pool: Pool

integration("PostgreSQL statistics queries", () => {
  beforeAll(async () => {
    const connectionString = process.env.TEST_DB_URL ?? process.env.DB_URL
    process.env.DB_URL = connectionString
    pool = new Pool({ connectionString })
    await pool.query("DROP SCHEMA IF EXISTS tt_stats_cache CASCADE")
    await pool.query("DROP TABLE IF EXISTS music, videos, users CASCADE")
    await pool.query(`
      CREATE TABLE users (
        user_id BIGINT PRIMARY KEY,
        registered_at BIGINT,
        lang VARCHAR NOT NULL DEFAULT 'en',
        link VARCHAR,
        file_mode BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE TABLE videos (
        pk_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(user_id),
        downloaded_at BIGINT,
        shared_link TEXT NOT NULL,
        media_kind VARCHAR NOT NULL CHECK (media_kind IN ('video', 'images')),
        delivery_surface VARCHAR NOT NULL CHECK (delivery_surface IN ('chat', 'inline')),
        delivery_mode VARCHAR,
        cache_hit BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE TABLE music (
        pk_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(user_id),
        downloaded_at BIGINT,
        video_id BIGINT NOT NULL
      )
    `)
    await pool.query(
      `INSERT INTO users (user_id, registered_at, lang, link, file_mode) VALUES
       (1, $1, 'en', 'alpha', TRUE),
       (2, $2, 'uk', 'beta', FALSE),
       (-10, $3, 'en', 'alpha', TRUE),
       (-20, $4, 'de', NULL, FALSE),
       (0, $5, 'zz', 'zero', TRUE),
       (3, NULL, 'fr', 'null-time', TRUE),
       (4, $6, 'es', 'unfinished', TRUE),
       (5, $7, 'it', 'future', TRUE)`,
      [
        windowEnd - 10,
        windowEnd - 86_400,
        windowEnd - 20,
        windowEnd - 700_000,
        windowEnd - 5,
        windowEnd + 10,
        now + 100,
      ]
    )
    await pool.query(
      `INSERT INTO videos (user_id, downloaded_at, shared_link, media_kind, delivery_surface, delivery_mode) VALUES
       (1, $1, 'https://example.test/new', 'video', 'chat', 'media'),
       (1, $2, 'https://example.test/images,"quoted"', 'images', 'inline', NULL),
       (1, $3, 'https://example.test/old', 'video', 'chat', 'document'),
       (2, $4, 'https://example.test/boundary', 'video', 'chat', 'media'),
       (-10, $5, 'https://example.test/group-image', 'images', 'chat', 'media'),
       (-20, $6, 'https://example.test/group-old', 'video', 'chat', 'media'),
       (0, $7, 'https://example.test/zero', 'video', 'chat', 'media'),
       (3, NULL, 'https://example.test/null-time', 'video', 'chat', 'media'),
       (4, $8, 'https://example.test/unfinished', 'video', 'chat', 'media'),
       (5, $9, 'https://example.test/future', 'video', 'chat', 'media')`,
      [
        windowEnd - 10,
        windowEnd - 20,
        windowEnd - 86_401,
        windowEnd - 86_400,
        windowEnd - 30,
        windowEnd - 700_000,
        windowEnd - 2,
        windowEnd + 10,
        now + 100,
      ]
    )
    await pool.query(
      `INSERT INTO music (user_id, downloaded_at, video_id) VALUES
       (1, $1, 101), (2, $2, 102), (-10, $3, 103), (0, $4, 104)`,
      [windowEnd - 10, windowEnd - 86_400, windowEnd - 20, windowEnd - 1]
    )
    const schema = await readFile(
      new URL("../../database/001_stats_snapshot_schema.sql", import.meta.url),
      "utf8"
    )
    await pool.query(schema)
    await pool.query(
      "CALL tt_stats_cache.refresh_rolling_24h(to_timestamp($1))",
      [now]
    )
    await pool.query("CALL tt_stats_cache.refresh_daily(to_timestamp($1))", [
      now,
    ])
  })

  afterAll(async () => {
    if (pool) await pool.end()
    await getPool().end()
  })

  it("returns overview and exact scoped breakdown counts as strings", async () => {
    const overview = await getOverviewRaw(pool)
    expect(overview.users.all.chats).toBe("2")
    expect(overview.groups.all.chats).toBe("2")
    expect(overview.users.last24Hours.downloads).toEqual({
      total: "3",
      uniqueUsers: "2",
      images: "1",
      uniqueImageUsers: "1",
    })
    expect((await getStatsBreakdownRaw("all", "24h", pool)).chats).toBe("3")
  })

  it("zero-fills analytics and excludes the zero ID", async () => {
    const points = await getTimeSeriesRaw("videos", "24h", pool)
    expect(points).toHaveLength(24)
    expect(points.at(-1)?.bucketEpoch).toBe(windowEnd - 3600)
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(4)
    expect(points.some((point) => point.count === 0)).toBe(true)
    expect(
      (await getTimeSeriesRaw("users", "all", pool)).reduce(
        (sum, point) => sum + point.count,
        0
      )
    ).toBe(4)
    expect(
      (await getTimeSeriesRaw("music", "24h", pool)).reduce(
        (sum, point) => sum + point.count,
        0
      )
    ).toBe(3)
  })

  it("builds only completed, expected-size buckets and matching cards", async () => {
    const sevenDays = await getTimeSeriesRaw("videos", "7d", pool)
    const month = await getTimeSeriesRaw("videos", "31d", pool)
    expect(sevenDays).toHaveLength(168)
    expect(month).toHaveLength(31)
    expect(sevenDays.at(-1)?.bucketEpoch).toBe(windowEnd - 3600)
    expect(month.at(-1)?.bucketEpoch).toBe(windowEnd - 86_400)

    for (const range of ["24h", "7d", "31d", "all"] as const) {
      const cards = await getStatsBreakdownRaw("all", range, pool)
      const [users, videos, music] = await Promise.all([
        getTimeSeriesRaw("users", range, pool),
        getTimeSeriesRaw("videos", range, pool),
        getTimeSeriesRaw("music", range, pool),
      ])
      const total = (points: typeof users) =>
        points.reduce((sum, point) => sum + point.count, 0)
      expect(Number(cards.chats)).toBe(total(users))
      expect(Number(cards.downloads.total)).toBe(total(videos))
      expect(Number(cards.music.total)).toBe(total(music))
    }
  })

  it("preserves the preceding snapshot when a refresh fails", async () => {
    for (const refresh of [
      {
        dataset: "rolling_24h",
        range: "24h",
        command: "CALL tt_stats_cache.refresh_rolling_24h(to_timestamp($1))",
        nextNow: now + 3600,
      },
      {
        dataset: "daily",
        range: "all",
        command: "CALL tt_stats_cache.refresh_daily(to_timestamp($1))",
        nextNow: now + 86_400,
      },
    ] as const) {
      const before = await getStatsBreakdownRaw("all", refresh.range, pool)
      const metadataBefore = await pool.query(
        "SELECT * FROM tt_stats_cache.refresh_metadata WHERE dataset = $1",
        [refresh.dataset]
      )
      await pool.query("ALTER TABLE public.videos RENAME TO videos_unavailable")
      try {
        await expect(
          pool.query(refresh.command, [refresh.nextNow])
        ).rejects.toThrow()
      } finally {
        await pool.query(
          "ALTER TABLE public.videos_unavailable RENAME TO videos"
        )
      }
      expect(await getStatsBreakdownRaw("all", refresh.range, pool)).toEqual(
        before
      )
      const metadataAfter = await pool.query(
        "SELECT * FROM tt_stats_cache.refresh_metadata WHERE dataset = $1",
        [refresh.dataset]
      )
      expect(metadataAfter.rows).toEqual(metadataBefore.rows)
    }
  })

  it("looks up lossless IDs and user attributes", async () => {
    expect(await getUserStatsRaw("-10", pool)).toMatchObject({
      userId: "-10",
      language: "en",
      referral: "alpha",
      fileMode: true,
      downloads: "1",
      images: "1",
    })
    expect(await getUserStatsRaw("999", pool)).toBeNull()
  })

  it("paginates user downloads in newest-first order", async () => {
    const firstPage = await getUserDownloadsRaw("1", 1, 2, pool)
    expect(firstPage).toMatchObject({
      page: 1,
      pageSize: 2,
      total: "3",
      totalPages: 2,
    })
    expect(firstPage.items.map((item) => item.sharedLink)).toEqual([
      "https://example.test/new",
      'https://example.test/images,"quoted"',
    ])

    const clampedPage = await getUserDownloadsRaw("1", 99, 2, pool)
    expect(clampedPage.page).toBe(2)
    expect(clampedPage.items[0]?.sharedLink).toBe("https://example.test/old")
  })

  it("streams escaped CSV in newest-first order with protected headers", async () => {
    const response = await getHistoryCsvResponse("1")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="user_1.csv"'
    )
    const csv = await response.text()
    expect(csv).toContain('"https://example.test/images,""quoted"""')
    expect(csv.indexOf("https://example.test/new")).toBeLessThan(
      csv.indexOf("https://example.test/old")
    )
  })

  it("returns deterministic referral, language, file mode, and downloader rankings", async () => {
    expect(await getReferralStatsRaw(pool)).toEqual([
      { value: "alpha", count: "2" },
      { value: "beta", count: "1" },
    ])
    const other = await getOtherStatsRaw(pool)
    expect(other.fileModeUsers).toBe("2")
    expect(other.languages[0]).toEqual({ value: "en", count: "2" })
    expect(other.topDownloaders[0]).toEqual({ value: "1", count: "3" })
    expect(await getBotstatUserIdsRaw(pool)).toEqual([
      "-20",
      "-10",
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
    ])
  })

  it.runIf(runPgCron)(
    "manages only fixed pg_cron jobs and queues idempotent manual work",
    async () => {
      await pool.query("CREATE EXTENSION IF NOT EXISTS pg_cron")
      await pool.query(`
        SELECT cron.schedule(
          'tt-stats-rolling-24h',
          '*/5 * * * *',
          'CALL tt_stats_cache.refresh_rolling_24h()'
        );
        SELECT cron.schedule(
          'tt-stats-daily',
          '7 0 * * *',
          'CALL tt_stats_cache.refresh_daily()'
        )
      `)

      const jobs = await getStatsJobsRaw(pool)
      expect(jobs.map((job) => job.jobName).sort()).toEqual([
        "tt-stats-daily",
        "tt-stats-rolling-24h",
      ])
      const rollingBefore = jobs.find((job) => job.dataset === "rolling_24h")
      const dailyBefore = jobs.find((job) => job.dataset === "daily")

      await expect(
        updateStatsJobScheduleRaw("rolling_24h", "not a cron schedule", pool)
      ).rejects.toThrow()
      expect(
        (await getStatsJobsRaw(pool)).find(
          (job) => job.dataset === "rolling_24h"
        )?.schedule
      ).toBe(rollingBefore?.schedule)

      await setStatsJobActiveRaw("rolling_24h", false, pool)
      const paused = await getStatsJobsRaw(pool)
      expect(paused.find((job) => job.dataset === "rolling_24h")?.active).toBe(
        false
      )
      expect(paused.find((job) => job.dataset === "daily")?.active).toBe(
        dailyBefore?.active
      )
      await setStatsJobActiveRaw("rolling_24h", true, pool)

      const startedAt = performance.now()
      const requestId = await requestStatsJobRunRaw("rolling_24h", pool)
      expect(performance.now() - startedAt).toBeLessThan(2_000)
      expect((await getManualRefreshRequestRaw(requestId, pool))?.status).toBe(
        "queued"
      )
      const request = await pool.query<{
        job_name: string
      }>(
        "SELECT job_name FROM tt_stats_cache.manual_refresh_requests WHERE id = $1",
        [requestId]
      )
      const jobName = request.rows[0]?.job_name
      expect(jobName).toBe(`tt-stats-manual-${requestId}`)
      await pool.query(
        "CALL tt_stats_cache.run_manual_refresh($1, 'rolling_24h', $2)",
        [requestId, jobName]
      )
      const firstResult = await getManualRefreshRequestRaw(requestId, pool)
      await pool.query(
        "CALL tt_stats_cache.run_manual_refresh($1, 'rolling_24h', $2)",
        [requestId, jobName]
      )
      expect(await getManualRefreshRequestRaw(requestId, pool)).toEqual(
        firstResult
      )
      expect(firstResult?.status).toBe("succeeded")

      await expect(
        pool.query(
          "SELECT tt_stats_cache.update_stats_job_schedule($1, '* * * * *')",
          ["rolling_24h'); DELETE FROM cron.job; --"]
        )
      ).rejects.toThrow()
      const commands = await pool.query<{ jobname: string; command: string }>(
        `SELECT jobname, command FROM cron.job
         WHERE jobname IN ('tt-stats-rolling-24h', 'tt-stats-daily')
         ORDER BY jobname`
      )
      expect(commands.rows).toEqual([
        {
          jobname: "tt-stats-daily",
          command: "CALL tt_stats_cache.refresh_daily()",
        },
        {
          jobname: "tt-stats-rolling-24h",
          command: "CALL tt_stats_cache.refresh_rolling_24h()",
        },
      ])

      const roleName = `tt_stats_app_test_${process.pid}`
      await pool.query(`CREATE ROLE ${roleName} NOLOGIN`)
      try {
        await pool.query(`
          GRANT USAGE ON SCHEMA tt_stats_cache TO ${roleName};
          GRANT SELECT ON tt_stats_cache.refresh_metadata,
                          tt_stats_cache.breakdown,
                          tt_stats_cache.time_series,
                          tt_stats_cache.rankings,
                          tt_stats_cache.scalars
          TO ${roleName};
          GRANT EXECUTE ON FUNCTION tt_stats_cache.list_stats_jobs()
          TO ${roleName}
        `)
        const client = await pool.connect()
        try {
          await client.query(`SET ROLE ${roleName}`)
          await expect(
            client.query("SELECT * FROM tt_stats_cache.list_stats_jobs()")
          ).resolves.toBeTruthy()
          await expect(
            client.query(
              "UPDATE tt_stats_cache.scalars SET value = 0 WHERE name = 'file_mode_users'"
            )
          ).rejects.toThrow()
          await expect(client.query("SELECT * FROM cron.job")).rejects.toThrow()
          await expect(
            client.query("SELECT tt_stats_cache._job_name('daily')")
          ).rejects.toThrow()
          await expect(
            client.query("CALL tt_stats_cache.refresh_rolling_24h()")
          ).rejects.toThrow()
        } finally {
          await client.query("RESET ROLE")
          client.release()
        }
      } finally {
        await pool.query(`DROP OWNED BY ${roleName}`)
        await pool.query(`DROP ROLE ${roleName}`)
      }
    }
  )
})
