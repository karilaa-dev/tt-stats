import { canReadMedia } from "@/lib/media/access"
import { getUserActivityRaw } from "@/lib/stats/user-activity"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { cancellableQuery } from "@/lib/db/cancellation"
import { DatabaseTask, withDatabaseTask } from "@/lib/tasks/server"
import { readFile } from "node:fs/promises"
import { Pool } from "pg"

import { getHistoryCsvResponse } from "@/lib/csv/history"
import { getPool } from "@/lib/db/pool"

import {
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

import {
  getDownloadersRaw,
  getPopularVideosRaw,
  getStoredMedia,
} from "@/lib/media/queries"

const run = process.env.RUN_DATABASE_INTEGRATION === "1"
const runPgCron = process.env.RUN_PG_CRON_INTEGRATION === "1"
const integration = describe.runIf(run)
const now = 2_000_074_937
const windowEnd = Math.floor(now / 3600) * 3600
let pool: Pool

integration("PostgreSQL statistics queries", () => {
  it("compares legacy history promptly without optional TT Stats indexes", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("INSERT INTO users(user_id) VALUES (998003), (998004)")
      await client.query(`INSERT INTO videos(user_id, downloaded_at, shared_link, media_kind, delivery_surface)
        SELECT CASE WHEN n <= 2271 THEN 998003 ELSE 998004 END, 1700000000 + n,
          'https://example.test/legacy-performance/' || ((n - 1) % 5000), 'video', 'chat'
        FROM generate_series(1, 102271) n`)
      await client.query("ANALYZE videos")
      await client.query("SET LOCAL statement_timeout = '1500ms'")
      const task = new DatabaseTask()
      const reports = vi.spyOn(task, "report")
      const adapter = {
        query: (text: string, values: unknown[]) => client.query(text, values),
      } as unknown as Pool
      const result = await withDatabaseTask(task, () =>
        getUserDownloadsRaw("998003", 1, 20, adapter, {
          mediaKind: "all",
          discovery: "others",
          sort: "popular",
        })
      )
      expect(result.total).toBe("2271")
      expect(result.items).toHaveLength(20)
      expect(result.items[0]?.otherUniqueChats).toBe("1")
      const progress = reports.mock.calls.filter(
        ([, completed]) => completed != null && completed > 0
      )
      expect(progress[0]?.slice(0, 3)).toEqual([
        "Comparing downloads",
        64,
        2271,
      ])
      expect(progress.at(-1)?.slice(0, 3)).toEqual([
        "Comparing downloads",
        2271,
        2271,
      ])
      expect(progress[0]?.[3]).toBeGreaterThan(0)
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })
  it("reuses comparisons when a date filter selects a later repeat of the same post", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("INSERT INTO users(user_id) VALUES (998001), (998002)")
      await client.query(`INSERT INTO videos(user_id, downloaded_at, shared_link, media_kind, delivery_surface)
        VALUES (998001, 1700000000, 'https://example.test/repeated-cache', 'video', 'chat'),
          (998001, 1700000100, 'https://example.test/repeated-cache', 'video', 'chat'),
          (998002, 1700000200, 'https://example.test/repeated-cache', 'video', 'chat')`)
      const execute = vi.fn((text: string, values: unknown[]) =>
        client.query(text, values)
      )
      const adapter = { query: execute } as unknown as Pool
      const filters = {
        mediaKind: "all",
        discovery: "first",
        sort: "popular",
      } as const
      const all = await getUserDownloadsRaw("998001", 1, 20, adapter, filters)
      expect(all.total).toBe("2")
      const filtered = await getUserDownloadsRaw("998001", 1, 20, adapter, {
        ...filters,
        from: 1700000050,
      })
      expect(filtered.total).toBe("1")
      expect(filtered.items[0]).toMatchObject({
        downloadedAt: 1700000100,
        otherUniqueChats: "1",
        isFirstDownloader: true,
      })
      expect(
        execute.mock.calls.filter(([sql]) => sql.includes("WITH identities AS"))
      ).toHaveLength(1)
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("keeps a tracked CSV cancellable until its stream finishes", async () => {
    const task = new DatabaseTask()
    const response = await withDatabaseTask(task, () =>
      getHistoryCsvResponse("1")
    )
    expect(response.status).toBe(200)
    expect(task.status().phase).toBe("Exporting downloads")
    task.controller.abort()
    await expect(response.text()).rejects.toThrow()
    expect((await getPool().query("SELECT 1 AS healthy")).rows[0].healthy).toBe(
      1
    )
  })
  it("reuses completed popularity comparisons across pages and discovery filters", async () => {
    const execute = vi.fn((text: string, values: unknown[]) =>
      pool.query(text, values)
    )
    const adapter = { query: execute } as unknown as Pool
    await getUserDownloadsRaw("1", 1, 1, adapter, {
      mediaKind: "all",
      discovery: "all",
      sort: "popular",
    })
    const comparisons = () =>
      execute.mock.calls.filter(([sql]) => sql.includes("WITH identities AS"))
        .length
    expect(comparisons()).toBe(1)
    await getUserDownloadsRaw("1", 2, 1, adapter, {
      mediaKind: "all",
      discovery: "others",
      sort: "popular",
    })
    expect(comparisons()).toBe(1)
    await getUserDownloadsRaw("2", 1, 1, adapter, {
      mediaKind: "all",
      discovery: "others",
      sort: "popular",
    })
    expect(comparisons()).toBe(2)
  })

  it("cancels the actual PostgreSQL query even when the read pool is full", async () => {
    const readPool = new Pool({
      connectionString: process.env.TEST_DB_URL,
      max: 1,
      application_name: "tt-stats-cancellation-test",
      statement_timeout: 5000,
    })
    const controller = new AbortController()
    const query = cancellableQuery(
      readPool,
      "SELECT pg_sleep(10)",
      [],
      controller.signal
    ).then(
      () => "unexpected completion",
      (error) => error.code
    )
    try {
      let active = false
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name = 'tt-stats-cancellation-test' AND state = 'active'"
        )
        if (result.rowCount) {
          active = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(active).toBe(true)
      const started = Date.now()
      controller.abort()
      expect(await query).toBe("57014")
      expect(Date.now() - started).toBeLessThan(2000)
      expect(
        (await readPool.query("SELECT 1 AS healthy")).rows[0].healthy
      ).toBe(1)
    } finally {
      controller.abort()
      await query
      await readPool.end()
    }
  })
  beforeAll(async () => {
    const connectionString = process.env.TEST_DB_URL
    if (
      !connectionString ||
      !new URL(connectionString).pathname.includes("test")
    )
      throw new Error(
        "An explicit isolated TEST_DB_URL with a test database name is required"
      )
    process.env.DB_URL = connectionString
    pool = new Pool({ connectionString })
    await pool.query("DROP SCHEMA IF EXISTS tt_stats_cache CASCADE")
    await pool.query("DROP TABLE IF EXISTS music, videos, users CASCADE")
    await pool.query("DROP TABLE IF EXISTS video_details CASCADE")
    await pool.query(
      await readFile(
        new URL("../fixtures/tt-bot-v6.0.10.sql", import.meta.url),
        "utf8"
      )
    )
    await pool.query(
      `INSERT INTO users (user_id, registered_at, lang, link, file_mode) VALUES
       (1, $1, 'en', 'alpha', TRUE),
       (2, $2, 'uk', 'beta', FALSE),
       (-10, $3, 'en', 'alpha', TRUE),
       (-20, $4, 'de', NULL, FALSE),
       (0, $5, 'zz', 'zero', TRUE),
       (3, NULL, 'fr', 'null-time', TRUE),
       (4, $6, 'es', 'unfinished', TRUE),
       (5, $7, 'it', 'future', TRUE),
       (6, 0, 'pt', 'invalid-epoch', TRUE)`,
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
      `INSERT INTO videos (user_id, downloaded_at, shared_link, media_kind, delivery_surface, delivery_mode, cache_hit) VALUES
       (1, $1, 'https://example.test/new', 'video', 'chat', 'media', TRUE),
       (1, $2, 'https://example.test/images,"quoted"', 'images', 'inline', NULL, FALSE),
       (1, $3, 'https://example.test/old', 'video', 'chat', 'document', FALSE),
       (2, $4, 'https://example.test/boundary', 'video', 'chat', 'media', FALSE),
       (-10, $5, 'https://example.test/group-image', 'images', 'chat', 'media', FALSE),
       (-20, $6, 'https://example.test/group-old', 'video', 'chat', 'media', FALSE),
       (0, $7, 'https://example.test/zero', 'video', 'chat', 'media', FALSE),
       (3, NULL, 'https://example.test/null-time', 'video', 'chat', 'media', FALSE),
       (4, $8, 'https://example.test/unfinished', 'video', 'chat', 'media', FALSE),
       (5, $9, 'https://example.test/future', 'video', 'chat', 'media', FALSE),
       (6, 0, 'https://example.test/invalid-epoch', 'video', 'chat', 'media', FALSE)`,
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
       (1, $1, 101), (2, $2, 102), (-10, $3, 103), (0, $4, 104),
       (6, 0, 105)`,
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
      cacheHits: "1",
    })
    const allChats = await getStatsBreakdownRaw("all", "24h", pool)
    expect(allChats.chats).toBe("3")
    expect(allChats.downloads.cacheHits).toBe("1")
  })

  it("allows owners to preview their media independently of ranking schema availability", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        "ALTER TABLE tt_stats_cache.popular_videos_metadata RENAME COLUMN ranking_version TO unavailable_version"
      )
      const db = client as unknown as Pool
      const id = (
        await client.query(
          "SELECT min(pk_id)::text AS id FROM videos WHERE user_id = 1"
        )
      ).rows[0].id
      expect(
        await canReadMedia(
          { admin: false, user: { id: "1", name: "Owner", username: null } },
          id,
          db
        )
      ).toBe(true)
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("groups personal activity in UTC, bounds detail, and isolates accounts", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(`INSERT INTO users(user_id) VALUES (777), (778)`)
      await client.query(`INSERT INTO videos(user_id, downloaded_at, shared_link, media_kind, delivery_surface, cache_hit)
        SELECT 777, floor(extract(epoch FROM now()))::bigint - n * 86400,
          'https://example.test/activity/' || n, 'video', 'chat', false FROM generate_series(0, 800) n`)
      await client.query(`INSERT INTO videos(user_id, downloaded_at, shared_link, media_kind, delivery_surface, cache_hit) VALUES
        (777, 0, 'https://example.test/invalid', 'video', 'chat', false),
        (777, 9999999999, 'https://example.test/future', 'video', 'chat', false),
        (778, extract(epoch FROM now())::bigint - 10, 'https://example.test/other', 'video', 'chat', false)`)
      await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'")
      const db = client as unknown as Pool
      const total = await getUserActivityRaw("777", "all", db)
      expect(total.interval).toBe("month")
      expect(total.points.length).toBeLessThanOrEqual(28)
      expect(total.points.reduce((sum, p) => sum + p.count, 0)).toBe(801)
      expect(
        total.points.every(
          (p) => new Date(p.bucketEpoch * 1000).getUTCDate() === 1
        )
      ).toBe(true)
      expect((await getUserActivityRaw("777", "31d", db)).points).toHaveLength(
        31
      )
      expect(
        (await getUserActivityRaw("777", "90d", db)).points.length
      ).toBeLessThanOrEqual(14)
      expect((await getUserActivityRaw("777", "1y", db)).points).toHaveLength(
        12
      )
      expect(
        (await getUserActivityRaw("778", "all", db)).points.reduce(
          (s, p) => s + p.count,
          0
        )
      ).toBe(1)
      expect(
        (await getUserActivityRaw("779", "all", db)).points.every(
          (p) => p.count === 0
        )
      ).toBe(true)
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("identifies an outdated snapshot column and repairs it without changing tt-bot tables", async () => {
    const before = await pool.query(
      "SELECT count(*)::text AS count FROM public.videos"
    )
    await pool.query(
      "ALTER TABLE tt_stats_cache.breakdown DROP COLUMN cache_hits"
    )
    try {
      await expect(getOverviewRaw(pool)).rejects.toMatchObject({
        kind: "snapshotSchema",
      })
    } finally {
      await pool.query(
        await readFile(
          new URL(
            "../../database/001_stats_snapshot_schema.sql",
            import.meta.url
          ),
          "utf8"
        )
      )
      await pool.query(
        "CALL tt_stats_cache.refresh_rolling_24h(to_timestamp($1))",
        [now]
      )
      await pool.query("CALL tt_stats_cache.refresh_daily(to_timestamp($1))", [
        now,
      ])
    }
    expect(
      (await getOverviewRaw(pool)).users.last24Hours.downloads.cacheHits
    ).toBe("1")
    expect(
      (await pool.query("SELECT count(*)::text AS count FROM public.videos"))
        .rows
    ).toEqual(before.rows)
  })

  it("zero-fills analytics and excludes the zero ID", async () => {
    const points = await getTimeSeriesRaw("videos", "24h", pool)
    expect(points).toHaveLength(48)
    expect(points.at(-1)?.bucketEpoch).toBe(windowEnd - 1800)
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(4)
    expect(points.some((point) => point.count === 0)).toBe(true)
    expect(
      (await getTimeSeriesRaw("users", "all", pool)).reduce(
        (sum, point) => sum + point.count,
        0
      )
    ).toBe(4)
    expect(
      (await getTimeSeriesRaw("users", "all", pool))[0]?.bucketEpoch
    ).toBeGreaterThanOrEqual(946_684_800)
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

  it("bounds an unusually long all-time chart without losing counts", async () => {
    await pool.query(
      "DELETE FROM tt_stats_cache.time_series WHERE metric = 'videos' AND range = 'all'"
    )
    await pool.query(`
      INSERT INTO tt_stats_cache.time_series (
        metric, range, bucket_epoch, count
      )
      SELECT 'videos', 'all', 946684800 + day * 86400, 1
      FROM generate_series(0, 1499) AS days(day)
    `)

    const points = await getTimeSeriesRaw("videos", "all", pool)
    expect(points.length).toBeLessThanOrEqual(720)
    expect(points.reduce((total, point) => total + point.count, 0)).toBe(1500)

    await pool.query("CALL tt_stats_cache.refresh_daily(to_timestamp($1))", [
      now,
    ])
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
    expect(firstPage.items.map((item) => item.cacheHit)).toEqual([true, false])

    const clampedPage = await getUserDownloadsRaw("1", 99, 2, pool)
    expect(clampedPage.page).toBe(2)
    expect(clampedPage.items[0]?.sharedLink).toBe("https://example.test/old")
  })

  it("resolves albums, lists related chats independently of cache, and ranks unique chats by video identity", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      // Use a single transaction so these events cannot change other statistics tests.
      const db = client as unknown as Pool
      await client.query(`INSERT INTO video_details (pk_id, platform, platform_video_id, telegram_bot_id, telegram_files)
        VALUES (100, 'tiktok', 'same-post', 123, '[{"position":0,"media_type":"video","file_id":"video-file","file_unique_id":"unique-video"},{"position":1,"media_type":"photo","file_id":"photo-file","file_unique_id":"unique-photo"}]')`)
      await client.query(`INSERT INTO videos (pk_id, user_id, video_details_id, downloaded_at, shared_link, media_kind, delivery_surface, cache_hit) VALUES
        (100, 1, 100, 10, 'https://example.test/alias-a', 'video', 'chat', true),
        (101, 2, 100, 20, 'https://example.test/alias-b', 'video', 'chat', false),
        (102, 2, 100, 30, 'https://example.test/alias-c', 'video', 'chat', true),
        (103, -10, 100, NULL, 'https://example.test/alias-d', 'video', 'chat', true),
        (104, 1, NULL, 40, 'https://example.test/alias-a', 'video', 'chat', true),
        (105, 1, NULL, 50, 'https://example.test/legacy', 'video', 'chat', false),
        (106, 2, NULL, 60, 'https://example.test/legacy', 'video', 'chat', false),
        (107, 2, NULL, 70, 'https://example.test/legacy', 'images', 'chat', false)`)
      expect(
        (await getStoredMedia("100", db))?.telegram_files?.map(
          (file) => file.media_type
        )
      ).toEqual(["video", "photo"])
      expect(await getStoredMedia("999999", db)).toBeNull()
      expect(await getDownloadersRaw("100", 1, db)).toEqual({
        page: 1,
        hasMore: false,
        items: [
          { userId: "2", downloads: "2", lastDownloadedAt: 30 },
          { userId: "-10", downloads: "1", lastDownloadedAt: null },
        ],
      })
      expect(
        (await getDownloadersRaw("101", 1, db)).items.map((item) => item.userId)
      ).toEqual(["-10", "1"])
      expect((await getDownloadersRaw("104", 1, db)).items).toEqual([])
      expect((await getDownloadersRaw("100", 2, db)).items).toEqual([])
      await client.query(
        "SELECT tt_stats_cache._refresh_popular_videos(to_timestamp($1))",
        [now]
      )
      // Cached pages remain readable even when the source table is unavailable.
      await client.query(
        "ALTER TABLE public.videos RENAME TO videos_unavailable"
      )
      const ranked = await getPopularVideosRaw(1, db)
      expect(ranked.items[0]).toMatchObject({
        downloadId: "100",
        uniqueChats: "3",
      })
      expect(ranked.items[1]).toMatchObject({
        sharedLink: "https://example.test/legacy",
        uniqueChats: "2",
      })
      expect((await getPopularVideosRaw(2, db)).items).toEqual([])
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("bounds persisted video rankings and stops pagination at 1,000 videos", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const db = client as unknown as Pool
      await client.query(`INSERT INTO videos (user_id, shared_link, media_kind, delivery_surface)
        SELECT 1, 'https://example.test/ranking/' || n, 'video', 'chat'
        FROM generate_series(1, 1100) n CROSS JOIN generate_series(1, 5) repeats`)
      await client.query(`INSERT INTO videos (user_id, shared_link, media_kind, delivery_surface)
        VALUES (1, 'https://example.test/unique-winner', 'video', 'chat'), (2, 'https://example.test/unique-winner', 'video', 'chat')`)
      await client.query(
        "SELECT tt_stats_cache._refresh_popular_videos(to_timestamp($1))",
        [now]
      )
      const count = await client.query(
        "SELECT count(*)::int AS count FROM tt_stats_cache.popular_videos WHERE range = 'all'"
      )
      expect(count.rows[0].count).toBe(1000)
      expect((await getPopularVideosRaw(1, db)).items[0]?.sharedLink).toBe(
        "https://example.test/unique-winner"
      )
      const lastPage = await getPopularVideosRaw(50, db)
      expect(lastPage.items).toHaveLength(20)
      expect(lastPage.hasMore).toBe(false)
      expect((await getPopularVideosRaw(51, db)).items).toEqual([])
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("distinguishes an unbuilt video ranking from a completed empty snapshot", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const db = client as unknown as Pool
      await client.query("DELETE FROM tt_stats_cache.popular_videos_metadata")
      await expect(getPopularVideosRaw(1, db)).rejects.toMatchObject({
        kind: "snapshotsMissing",
      })
      await client.query("DELETE FROM tt_stats_cache.popular_videos")
      await client.query(
        "INSERT INTO tt_stats_cache.popular_videos_metadata (singleton, refreshed_at, ranking_version) VALUES (TRUE, to_timestamp($1), 2)",
        [now]
      )
      expect(await getPopularVideosRaw(1, db)).toEqual({
        items: [],
        page: 1,
        hasMore: false,
        refreshedAt: now,
        range: "all",
      })
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("counts downloads and unique chats within each ranking period without replacing other periods", async () => {
    const client = await pool.connect()
    const end = Math.floor(now / 86400) * 86400
    try {
      await client.query("BEGIN")
      const db = client as unknown as Pool
      await client.query("DELETE FROM public.videos")
      await client.query(
        "INSERT INTO video_details (pk_id, platform, platform_video_id) VALUES (900, 'tiktok', 'period-test')"
      )
      await client.query(
        `INSERT INTO videos (user_id, video_details_id, downloaded_at, shared_link, media_kind, delivery_surface)
        SELECT user_id, 900, CASE WHEN age IS NULL THEN NULL ELSE $1::bigint - age END,
          'https://example.test/period-linked/' || user_id, 'video', 'chat'
        FROM (VALUES (1, 1), (1, 2), (2, 86400), (3, 86401), (-10, 604800),
          (-20, 604801), (0, 2678400), (4, 2678401), (5, NULL), (6, 0)) events(user_id, age)`,
        [end]
      )
      await client.query(
        `INSERT INTO videos (user_id, downloaded_at, shared_link, media_kind, delivery_surface) VALUES
        (1, $1::bigint - 1, 'https://example.test/period-legacy', 'video', 'chat'),
        (2, $1::bigint - 86401, 'https://example.test/period-legacy', 'video', 'chat'),
        (1, $1::bigint - 1, 'https://example.test/period-legacy', 'images', 'chat')`,
        [end]
      )
      const cases = [
        ["24h", "3", "2", "1"],
        ["7d", "5", "4", "2"],
        ["31d", "6", "5", "2"],
        ["all", "9", "8", "2"],
      ] as const
      for (const [range] of cases) {
        await client.query(
          "SELECT tt_stats_cache._refresh_popular_videos(to_timestamp($1), $2)",
          [end + 600, range]
        )
      }
      for (const [range, , uniqueChats, legacyDownloads] of cases) {
        const ranking = await getPopularVideosRaw(1, db, range)
        expect(ranking.range).toBe(range)
        expect(ranking.items[0]).toMatchObject({ uniqueChats })
        expect(ranking.items[0]).not.toHaveProperty("downloads")
        expect(ranking.items[1]).toMatchObject({
          sharedLink: "https://example.test/period-legacy",
          uniqueChats: legacyDownloads,
        })
        expect(ranking.items).toHaveLength(2)
      }
      await client.query(
        "SELECT tt_stats_cache._refresh_popular_videos(to_timestamp($1), '24h')",
        [end + 1800]
      )
      expect((await getPopularVideosRaw(1, db, "all")).refreshedAt).toBe(
        end + 600
      )
      expect((await getPopularVideosRaw(1, db, "24h")).refreshedAt).toBe(
        end + 1800
      )
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("compares all history, handles repeat downloads and uncertain timestamps, and filters personal history", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const db = client as unknown as Pool
      const epoch = Math.floor(Date.now() / 1000) - 100
      await client.query(
        `INSERT INTO video_details (pk_id, platform, platform_video_id) VALUES (990, 'tiktok', 'personal-test')`
      )
      await client.query(
        `INSERT INTO videos (pk_id, user_id, video_details_id, downloaded_at, shared_link, media_kind, delivery_surface, cache_hit) VALUES
        (99001, 1, 990, $1::bigint, 'https://example.test/first', 'video', 'chat', true),
        (99002, 2, 990, $1::bigint, 'https://example.test/alias', 'video', 'chat', false),
        (99003, 2, 990, $1::bigint + 1, 'https://example.test/repeat', 'video', 'chat', false),
        (99004, -10, 990, $1::bigint + 2, 'https://example.test/group', 'video', 'chat', true),
        (99005, 0, 990, NULL, 'https://example.test/placeholder', 'video', 'chat', true)`,
        [epoch]
      )
      const first = (await getUserDownloadsRaw("1", 1, 20, db)).items.find(
        (item) => item.id === "99001"
      )
      expect(first).toMatchObject({
        isFirstDownloader: true,
        otherUniqueChats: "2",
        cacheHit: true,
      })
      const repeated = (await getUserDownloadsRaw("2", 1, 20, db)).items.filter(
        (item) => item.videoDetailsId === "990"
      )
      expect(repeated).toHaveLength(2)
      expect(
        repeated.every(
          (item) =>
            item.isFirstDownloader === false && item.otherUniqueChats === "2"
        )
      ).toBe(true)
      const filtered = await getUserDownloadsRaw("1", 1, 20, db, {
        from: epoch - 86400,
        until: epoch + 100,
        mediaKind: "video",
        discovery: "all",
        sort: "newest",
      })
      expect(filtered.items.map((item) => item.id)).toEqual(["99001"])
      const anonymous = { admin: false, user: null }
      const owner = {
        admin: false,
        user: { id: "1", name: "Owner", username: null },
      }
      const stranger = {
        admin: false,
        user: { id: "3", name: "Stranger", username: null },
      }
      expect(await canReadMedia(owner, "99001", db)).toBe(true)
      expect(await canReadMedia(stranger, "99001", db)).toBe(false)
      expect(await canReadMedia(anonymous, "99001", db)).toBe(false)
      expect(await canReadMedia({ admin: true, user: null }, "99001", db)).toBe(
        true
      )
      await client.query("SELECT tt_stats_cache._refresh_popular_videos(now())")
      expect(await canReadMedia(anonymous, "99001", db)).toBe(true)
      expect(await canReadMedia(anonymous, "99003", db)).toBe(false)
      expect(await canReadMedia(anonymous, "999999999", db)).toBe(false)
      const stats = await getUserStatsRaw("1", db)
      expect(stats?.activity).toHaveLength(31)
      expect(stats?.latestDownloadAt).toBe(epoch)
      await client.query(
        "UPDATE videos SET downloaded_at = NULL WHERE pk_id = 99002"
      )
      expect(
        (await getUserDownloadsRaw("1", 1, 20, db)).items.find(
          (item) => item.id === "99001"
        )?.isFirstDownloader
      ).toBeNull()
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })

  it("filters and ranks all matching history before pagination with global first-downloader comparisons", async () => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const db = client as unknown as Pool
      const base = 1786233600
      await client.query(
        "INSERT INTO users(user_id) VALUES (4001), (4002), (4003), (-4004)"
      )
      await client.query(`INSERT INTO video_details(pk_id, platform, platform_video_id)
        SELECT n, 'tiktok', 'discovery-' || n FROM generate_series(5501, 5504) n`)
      await client.query(
        `INSERT INTO videos(pk_id, user_id, video_details_id, downloaded_at, shared_link, media_kind, delivery_surface, cache_hit) VALUES
        (91001, 4001, 5501, $1::bigint - 1000, 'https://example.test/alpha-first', 'video', 'chat', true),
        (91002, 4001, 5501, $1::bigint + 5, 'https://example.test/alpha-repeat', 'video', 'chat', false),
        (91003, 4002, 5501, $1::bigint + 10, 'https://example.test/alpha-alias', 'video', 'chat', false),
        (91004, 4002, 5501, $1::bigint + 11, 'https://example.test/alpha-again', 'video', 'chat', false),
        (91005, -4004, 5501, $1::bigint + 12, 'https://example.test/alpha-group', 'video', 'chat', false),
        (91006, 0, 5501, NULL, 'https://example.test/placeholder', 'video', 'chat', false),
        (91007, 4002, 5502, $1::bigint - 2000, 'https://example.test/beta-first', 'video', 'chat', false),
        (91008, 4001, 5502, $1::bigint + 6, 'https://example.test/beta', 'video', 'chat', false),
        (91009, 4003, 5502, $1::bigint + 8, 'https://example.test/beta-other', 'video', 'chat', false),
        (91010, -4004, 5502, $1::bigint + 9, 'https://example.test/beta-group', 'video', 'chat', false),
        (91011, 4001, 5503, $1::bigint + 20, 'https://example.test/tie', 'video', 'chat', true),
        (91012, 4002, 5503, $1::bigint + 20, 'https://example.test/tie-other', 'video', 'chat', false),
        (91013, 4001, 5504, $1::bigint + 21, 'https://example.test/uncertain', 'video', 'chat', true),
        (91014, 4002, 5504, NULL, 'https://example.test/unknown-time', 'video', 'chat', false),
        (91015, 4001, NULL, $1::bigint + 22, 'https://example.test/legacy', 'video', 'chat', true),
        (91016, 4002, NULL, $1::bigint + 23, 'https://example.test/legacy', 'video', 'chat', false),
        (91017, 4003, NULL, $1::bigint + 24, 'https://example.test/legacy?different', 'video', 'chat', false),
        (91018, 4003, NULL, $1::bigint + 24, 'https://example.test/legacy', 'images', 'chat', false)`,
        [base]
      )
      await client.query(
        `INSERT INTO videos(user_id, downloaded_at, shared_link, media_kind, delivery_surface, cache_hit)
        SELECT 4001, $1::bigint + n, 'https://example.test/unshared/' || n, 'video', 'chat', false
        FROM generate_series(500, 524) n`,
        [base]
      )
      const filters = {
        from: base,
        until: base + 600,
        mediaKind: "video" as const,
        discovery: "others" as const,
        sort: "popular" as const,
      }
      const firstPage = await getUserDownloadsRaw("4001", 1, 2, db, filters)
      expect(firstPage).toMatchObject({ total: "5", totalPages: 3, page: 1 })
      expect(
        firstPage.items.map((item) => [item.id, item.otherUniqueChats])
      ).toEqual([
        ["91008", "3"],
        ["91002", "2"],
      ])
      expect(firstPage.items[1]?.isFirstDownloader).toBe(true)
      expect(
        (await getUserDownloadsRaw("4001", 2, 2, db, filters)).items.map(
          (item) => item.id
        )
      ).toEqual(["91015", "91013"])
      expect(
        await getUserDownloadsRaw("4001", 99, 2, db, filters)
      ).toMatchObject({ page: 3, items: [{ id: "91011" }] })
      const pioneers = await getUserDownloadsRaw("4001", 1, 20, db, {
        ...filters,
        discovery: "first",
      })
      expect(pioneers.total).toBe("3")
      expect(pioneers.items.map((item) => item.id)).toEqual([
        "91002",
        "91015",
        "91011",
      ])
      expect(
        pioneers.items.every(
          (item) =>
            item.isFirstDownloader === true &&
            BigInt(item.otherUniqueChats!) > 0n
        )
      ).toBe(true)
      expect(
        (
          await getUserDownloadsRaw("4001", 1, 2, db, {
            ...filters,
            discovery: "all",
          })
        ).items.map((item) => item.id)
      ).toEqual(["91008", "91002"])
      const datesOnly = await getUserDownloadsRaw("4001", 1, 20, db, {
        ...filters,
        until: base + 20,
        discovery: "all",
        sort: "newest",
      })
      expect(datesOnly.items.map((item) => item.id)).toEqual(["91008", "91002"])
      const empty = await getUserDownloadsRaw("4001", 99, 20, db, {
        ...filters,
        from: base + 600,
      })
      expect(empty).toMatchObject({
        page: 1,
        total: "0",
        totalPages: 0,
        items: [],
      })
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
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
