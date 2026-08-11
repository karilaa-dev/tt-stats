import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Pool } from "pg"

import { getHistoryCsvResponse } from "@/lib/csv/history"
import { getPool } from "@/lib/db/pool"

import {
  getBotstatUserIdsRaw,
  getOtherStatsRaw,
  getOverviewRaw,
  getReferralStatsRaw,
  getStatsBreakdownRaw,
  getTimeSeriesRaw,
  getUserDownloadsRaw,
  getUserStatsRaw,
} from "@/lib/stats/queries"

const run = process.env.RUN_DATABASE_INTEGRATION === "1"
const integration = describe.runIf(run)
const now = 2_000_000_000
let pool: Pool

integration("PostgreSQL statistics queries", () => {
  beforeAll(async () => {
    const connectionString = process.env.TEST_DB_URL ?? process.env.DB_URL
    process.env.DB_URL = connectionString
    pool = new Pool({ connectionString })
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
       (0, $5, 'zz', 'zero', TRUE)`,
      [now - 10, now - 86_400, now - 20, now - 700_000, now - 5]
    )
    await pool.query(
      `INSERT INTO videos (user_id, downloaded_at, shared_link, media_kind, delivery_surface, delivery_mode) VALUES
       (1, $1, 'https://example.test/new', 'video', 'chat', 'media'),
       (1, $2, 'https://example.test/images,"quoted"', 'images', 'inline', NULL),
       (1, $3, 'https://example.test/old', 'video', 'chat', 'document'),
       (2, $4, 'https://example.test/boundary', 'video', 'chat', 'media'),
       (-10, $5, 'https://example.test/group-image', 'images', 'chat', 'media'),
       (-20, $6, 'https://example.test/group-old', 'video', 'chat', 'media'),
       (0, $7, 'https://example.test/zero', 'video', 'chat', 'media')`,
      [
        now - 10,
        now - 20,
        now - 86_401,
        now - 86_400,
        now - 30,
        now - 700_000,
        now - 2,
      ]
    )
    await pool.query(
      `INSERT INTO music (user_id, downloaded_at, video_id) VALUES
       (1, $1, 101), (2, $2, 102), (-10, $3, 103), (0, $4, 104)`,
      [now - 10, now - 86_400, now - 20, now - 1]
    )
  })

  afterAll(async () => {
    if (pool) await pool.end()
    await getPool().end()
  })

  it("returns overview and exact scoped breakdown counts as strings", async () => {
    const overview = await getOverviewRaw(now, pool)
    expect(overview.users.all.chats).toBe("2")
    expect(overview.groups.all.chats).toBe("2")
    expect(overview.users.last24Hours.downloads).toEqual({
      total: "3",
      uniqueUsers: "2",
      images: "1",
      uniqueImageUsers: "1",
    })
    expect((await getStatsBreakdownRaw("all", "24h", now, pool)).chats).toBe(
      "3"
    )
  })

  it("zero-fills analytics and excludes the zero ID", async () => {
    const points = await getTimeSeriesRaw("videos", "24h", now, pool)
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(4)
    expect(points.some((point) => point.count === 0)).toBe(true)
    expect(
      (await getTimeSeriesRaw("users", "all", now, pool)).reduce(
        (sum, point) => sum + point.count,
        0
      )
    ).toBe(4)
    expect(
      (await getTimeSeriesRaw("music", "24h", now, pool)).reduce(
        (sum, point) => sum + point.count,
        0
      )
    ).toBe(3)
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
      { value: "zero", count: "1" },
    ])
    const other = await getOtherStatsRaw(pool)
    expect(other.fileModeUsers).toBe("3")
    expect(other.languages[0]).toEqual({ value: "en", count: "2" })
    expect(other.topDownloaders[0]).toEqual({ value: "1", count: "3" })
    expect(await getBotstatUserIdsRaw(pool)).toEqual([
      "-20",
      "-10",
      "0",
      "1",
      "2",
    ])
  })
})
