import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"
import { loginAsAdmin } from "./session-fixture"

// Demo mode has no saved Telegram files. Serve a small file through the media
// routes: sound.mp4 is H.264/AAC; hevc.mp4 is H.265/AAC, which Chromium
// without an HEVC decoder plays as sound only.
async function serveMedia(
  page: Page,
  file: "sound.mp4" | "hevc.mp4",
  mediaType: "video" | "audio"
) {
  const body = await readFile(new URL(`./fixtures/${file}`, import.meta.url))
  await page.route(
    (url) => url.pathname.startsWith("/api/media/"),
    (route) => {
      const parts = new URL(route.request().url()).pathname.split("/")
      const id = decodeURIComponent(parts[3]!)
      if (parts.length === 4)
        return route.fulfill({
          json: {
            unavailableReason: null,
            items: [{ position: 0, mediaType, url: `/api/media/${id}/0` }],
          },
        })
      // Answer byte ranges like the media proxy so the file stays seekable.
      const range = /^bytes=(\d+)-(\d*)$/u.exec(
        route.request().headers()["range"] ?? ""
      )
      if (!range)
        return route.fulfill({
          contentType: "video/mp4",
          headers: { "Accept-Ranges": "bytes" },
          body,
        })
      const start = Number(range[1])
      const end = Math.min(
        body.length - 1,
        range[2] ? Number(range[2]) : body.length - 1
      )
      return route.fulfill({
        status: 206,
        contentType: "video/mp4",
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${body.length}`,
        },
        body: body.subarray(start, end + 1),
      })
    }
  )
}

async function open(page: Page, url: string) {
  await page.goto(url)
  // Controls ignore input until the page's island has hydrated.
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
}

test("top videos rank each platform separately and mark every video's platform", async ({
  page,
}, testInfo) => {
  await open(page, "/dashboard/videos?range=all")
  const table = page.getByRole("table", { name: "Most downloaded videos" })
  const rows = table.getByRole("row")
  await expect(rows).toHaveCount(21)
  await expect(rows.nth(1).locator(".platform-mark")).toHaveAttribute(
    "data-platform",
    "tiktok"
  )
  await expect(rows.nth(1).locator(".platform-mark")).toHaveAttribute(
    "title",
    "TikTok"
  )
  await expect(rows.nth(5)).toContainText("DEMO_TOP_REEL_05")
  await expect(rows.nth(5).locator(".platform-mark")).toHaveAttribute(
    "data-platform",
    "instagram"
  )
  await expect(
    page.getByText(
      "Only video downloads count: audio, image albums, and legacy downloads without a video ID are excluded."
    )
  ).toBeVisible()
  const platforms = page.getByRole("group", {
    name: "Download platform",
    exact: true,
  })
  await expect(
    platforms.getByRole("button", { name: "All platforms", exact: true })
  ).toHaveAttribute("aria-pressed", "true")

  await platforms
    .getByRole("button", { name: "Instagram", exact: true })
    .click()
  await expect(page).toHaveURL(/platform=instagram/)
  await expect(
    page.getByText("Top 1,000 Instagram videos", { exact: true })
  ).toBeVisible()
  await expect(rows).toHaveCount(6)
  await expect(rows.nth(1).getByRole("cell").first()).toHaveText("1")
  await expect(rows.nth(1)).toContainText("DEMO_TOP_REEL_05")
  await expect(table.locator('[data-platform="tiktok"]')).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath("top-videos-instagram.png"),
    fullPage: true,
  })

  // Changing the period keeps the platform, and reloads restore both.
  await page
    .getByRole("group", { name: "Statistics period", exact: true })
    .getByRole("button", { name: "7 days", exact: true })
    .click()
  await expect(page).toHaveURL(/range=7d/)
  await expect(page).toHaveURL(/platform=instagram/)
  await page.reload()
  await expect(
    platforms.getByRole("button", { name: "Instagram", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(rows).toHaveCount(6)

  await platforms.getByRole("button", { name: "TikTok", exact: true }).click()
  await expect(page).toHaveURL(/platform=tiktok/)
  await expect(rows).toHaveCount(21)
  await expect(table.locator('[data-platform="instagram"]')).toHaveCount(0)
  await platforms
    .getByRole("button", { name: "All platforms", exact: true })
    .click()
  await expect(page).not.toHaveURL(/platform=/)
  await expect(rows.nth(5)).toContainText("DEMO_TOP_REEL_05")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
})

test("a video the browser can play only as sound explains the missing picture", async ({
  page,
}, testInfo) => {
  await serveMedia(page, "hevc.mp4", "video")
  await open(page, "/dashboard/videos?range=all")
  await page
    .getByRole("table", { name: "Most downloaded videos" })
    .getByRole("button", { name: "View media" })
    .first()
    .click()
  const dialog = page.getByRole("dialog", { name: "Saved media" })
  await expect(
    dialog.getByText("Only the sound can play in this browser")
  ).toBeVisible()
  await expect(
    dialog.getByRole("link", { name: "Download video" })
  ).toHaveAttribute("download", "ttgrab-7539876543210000001.mp4")
  await expect(
    dialog.getByRole("link", { name: /Open original post/ })
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("sound-only-video.png") })
})

test("a decodable video plays without the sound-only notice", async ({
  page,
}) => {
  await serveMedia(page, "sound.mp4", "video")
  await open(page, "/dashboard/videos?range=all")
  await page
    .getByRole("table", { name: "Most downloaded videos" })
    .getByRole("button", { name: "View media" })
    .first()
    .click()
  const video = page
    .getByRole("dialog", { name: "Saved media" })
    .getByLabel("Saved video 1")
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.videoWidth)
    )
    .toBe(64)
  await expect(
    page.getByText("Only the sound can play in this browser")
  ).toHaveCount(0)
})

test("profile history filters by platform and Popular lists each post once", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await loginAsAdmin(context, baseURL!)
  await open(page, "/dashboard/me")
  const history = page.getByRole("list", {
    name: "Download history",
    exact: true,
  })
  await expect(history.getByRole("listitem")).toHaveCount(20)
  await expect(history.getByRole("listitem").first()).toContainText("TikTok")
  const platforms = page.getByRole("group", { name: "Platform", exact: true })
  await platforms
    .getByRole("button", { name: "Instagram", exact: true })
    .click()
  await expect(page).toHaveURL(/platform=instagram/)
  await expect(history.getByRole("listitem")).toHaveCount(6)
  for (const row of await history.getByRole("listitem").all())
    await expect(row).toContainText("Instagram")
  await expect(
    page.getByText(
      "Older downloads without platform information appear only under All platforms. Audio downloads are recorded for TikTok only."
    )
  ).toBeVisible()

  await platforms.getByRole("button", { name: "TikTok", exact: true }).click()
  await page
    .getByRole("group", { name: "Media type", exact: true })
    .getByRole("button", { name: "Videos", exact: true })
    .click()
  await expect(page).toHaveURL(/platform=tiktok/)
  await expect(history.getByRole("listitem")).toHaveCount(15)
  // Download history keeps every repeat of the same post.
  await expect(
    history.getByRole("listitem").filter({ hasText: "7539876543210000002" })
  ).toHaveCount(3)

  await page.getByRole("tab", { name: "Popular downloads" }).click()
  await expect(page).toHaveURL(/category=popular/)
  const popular = page.getByRole("list", {
    name: "Popular downloads",
    exact: true,
  })
  await expect(popular.getByRole("listitem")).toHaveCount(13)
  const repeated = popular
    .getByRole("listitem")
    .filter({ hasText: "7539876543210000002" })
  await expect(repeated).toHaveCount(1)
  await expect(repeated).toContainText("You downloaded this 3 times")
  await page.reload()
  await expect(popular.getByRole("listitem")).toHaveCount(13)
  await expect(
    platforms.getByRole("button", { name: "TikTok", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await page.screenshot({
    path: testInfo.outputPath("profile-popular-tiktok.png"),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
})

test("audio downloads play in the audio player", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await loginAsAdmin(context, baseURL!)
  await open(page, "/dashboard/me?mediaKind=audio")
  const history = page.getByRole("list", {
    name: "Download history",
    exact: true,
  })
  await expect(history.getByRole("listitem")).toHaveCount(3)
  const play = history.getByRole("button", { name: "Play audio" })
  await expect(play).toHaveCount(2)
  await expect(history.getByRole("button", { name: "View media" })).toHaveCount(
    0
  )

  // The real route accepts the audio ID; demo mode has no saved files.
  await play.first().click()
  const dialog = page.getByRole("dialog", { name: "Saved audio" })
  await expect(
    dialog.getByText("Saved media is unavailable in demo mode.")
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)

  await serveMedia(page, "sound.mp4", "audio")
  await play.last().click()
  const player = dialog.getByRole("region", { name: "Audio player" })
  await expect(player).toContainText("TikTok sound")
  await expect(player).toContainText("7539876543210000004")
  await expect(player.getByText("0:03", { exact: true })).toBeVisible()
  await expect(dialog.locator("video")).toHaveCount(0)
  const audio = player.locator("audio")
  await player.getByRole("button", { name: "Play", exact: true }).click()
  await expect(
    player.getByRole("button", { name: "Pause", exact: true })
  ).toBeVisible()
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime)
    )
    .toBeGreaterThan(0.3)
  await player.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(
    player.getByRole("button", { name: "Play", exact: true })
  ).toBeVisible()

  const seek = player.getByRole("slider", { name: "Seek" })
  await seek.focus()
  await page.keyboard.press("Home")
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime)
    )
    .toBe(0)
  await expect(seek).toHaveAttribute("aria-valuetext", "Elapsed 0:00 of 0:03")
  await player.getByRole("button", { name: "Forward 10 seconds" }).click()
  await expect
    .poll(() =>
      audio.evaluate(
        (element: HTMLAudioElement) => element.duration - element.currentTime
      )
    )
    .toBeLessThan(0.05)

  await player.getByRole("button", { name: "Mute", exact: true }).click()
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.muted)
  ).toBe(true)
  await player.getByRole("button", { name: "Playback speed 1×" }).click()
  expect(
    await audio.evaluate((element: HTMLAudioElement) => element.playbackRate)
  ).toBe(1.25)
  await page.screenshot({ path: testInfo.outputPath("audio-player.png") })

  // Popular merges the repeated sound into one row.
  await page.keyboard.press("Escape")
  await page.getByRole("tab", { name: "Popular downloads" }).click()
  const popular = page.getByRole("list", {
    name: "Popular downloads",
    exact: true,
  })
  await expect(popular.getByRole("listitem")).toHaveCount(2)
  await expect(
    popular.getByRole("listitem").filter({ hasText: "7539876543210000004" })
  ).toContainText("You downloaded this 2 times")
})
