import { expect, test } from "@playwright/test"
import { loginAsAdmin } from "./session-fixture"

test("profiles display a photo and filter audio history on personal and admin pages", async ({
  page,
  context,
  baseURL,
  isMobile,
}, testInfo) => {
  await loginAsAdmin(context, baseURL!)
  await page.route("**/api/users/*/avatar", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#087e8b"/></svg>',
    })
  )
  for (const url of ["/dashboard/me", "/dashboard/users?id=123456789"]) {
    await page.goto(url)
    const photo = page.locator(".profile-avatar img")
    await expect(photo).toBeVisible()
    await expect
      .poll(() =>
        photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)
      )
      .toBeGreaterThan(0)
    await page
      .getByRole("group", { name: "Media type", exact: true })
      .getByRole("button", { name: "Audio", exact: true })
      .click()
    await expect(page).toHaveURL(/mediaKind=audio/)
    const history = page.getByRole("list", {
      name: "Download history",
      exact: true,
    })
    await expect(history.getByRole("listitem")).toHaveCount(3)
    for (const row of await history.getByRole("listitem").all()) {
      await expect(row.getByText("Audio", { exact: true })).toBeVisible()
      await expect(row.getByRole("link").first()).toHaveAttribute(
        "href",
        /tiktok\.com/
      )
    }
    await expect(
      history.getByRole("button", { name: "View media" })
    ).toHaveCount(0)
    await expect(
      history.getByRole("button", { name: "Other downloaders" })
    ).toHaveCount(0)
    await page.reload()
    await expect(history.getByRole("listitem")).toHaveCount(3)
    if (isMobile) await page.setViewportSize({ width: 320, height: 740 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  }
  await page.screenshot({
    path: testInfo.outputPath("audio-profile.png"),
    fullPage: true,
  })
  await page.goto("/dashboard/videos?range=all")
  await expect(page.locator(".ranking-dates").first()).toBeVisible()
  if (isMobile) await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath("top-video-dates.png"),
    fullPage: true,
  })
  await page.screenshot({
    path: testInfo.outputPath("top-video-dates-viewport.png"),
  })
})
