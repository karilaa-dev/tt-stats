import { loginAsAdmin } from "./session-fixture"
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ context, baseURL }) => {
  await loginAsAdmin(context, baseURL!)
})

test("slow ranking shows measured progress and cancellation permits a retry", async ({
  page,
  isMobile,
}, testInfo) => {
  let release: (() => void) | undefined
  let delayed = true
  let cancelledId: string | null = null
  let requestId: string | undefined
  await page.route("**/_actions/getUserDownloads/**", async (route) => {
    if (route.request().postDataJSON().category !== "popular" || !delayed)
      return route.continue()
    requestId = route.request().headers()["x-database-task"]
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.abort().catch(() => {})
  })
  await page.route("**/api/tasks?*", async (route) => {
    const ids = new URL(route.request().url()).searchParams
      .get("ids")!
      .split(",")
    if (route.request().method() === "DELETE") {
      cancelledId = ids[0]!
      delayed = false
      await route.fulfill({ status: 204 })
      release?.()
    } else
      await route.fulfill({
        json: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              phase: "Comparing downloads",
              completed: 250,
              total: 1000,
              remainingMs: 6000,
              elapsedMs: 2000,
              state: "running",
            },
          ])
        ),
      })
  })
  await page.goto("/dashboard/users?id=123456789")
  await expect(
    page.getByRole("list", { name: "Download history" })
  ).toBeVisible()
  await page
    .getByRole("tab", { name: "Popular downloads", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Loading your data" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "25")
  await expect(dialog).toContainText("250 / 1,000 videos")
  await expect(dialog).toContainText("About 6s left")
  await expect(dialog).toContainText("Elapsed:")
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  if (isMobile) await page.setViewportSize({ width: 320, height: 640 })
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true })
  ).toBeInViewport()
  await page.screenshot({
    path: testInfo.outputPath("database-progress-light.png"),
  })
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await page.screenshot({
    path: testInfo.outputPath("database-progress-dark.png"),
  })
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(cancelledId).toBe(requestId)
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page.getByRole("list", { name: "Popular downloads" })
  ).toBeVisible()
  await expect(dialog).toBeHidden()
})

test("full history exports through the tracked download", async ({ page }) => {
  await page.goto("/dashboard/users?id=123456789")
  const exportLink = page.getByRole("link", { name: "Export full history" })
  await expect(exportLink).toBeVisible()
  const request = page.waitForRequest((request) =>
    request.url().endsWith("/api/users/123456789/history.csv")
  )
  const download = page.waitForEvent("download")
  await exportLink.click()
  expect((await request).headers()["x-database-task"]).toMatch(/^[\da-f-]{36}$/)
  expect((await download).suggestedFilename()).toBe("user_123456789.csv")
  await expect(exportLink).toHaveAttribute("aria-disabled", "false")
})
