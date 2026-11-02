import { expect, test } from "@playwright/test"
import { loginAsAdmin, seedTestSession } from "./session-fixture"

test("only admins can read scraper accounts, including direct action requests", async ({
  page,
  context,
  request,
  baseURL,
  isMobile,
}, testInfo) => {
  const token = await seedTestSession("456")
  expect(
    (
      await request.post("/_actions/getScraperStatus", {
        data: { range: "24h" },
        headers: { origin: baseURL!, Cookie: `tt_stats_user=${token}` },
      })
    ).status()
  ).toBe(401)
  await page.goto("/dashboard/accounts")
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole("link", { name: "Scraper accounts", exact: true })
  ).toHaveCount(0)
  await loginAsAdmin(context, baseURL!)
  await page.goto("/dashboard/accounts")
  await expect(
    page.getByRole("heading", { name: "Scraper accounts", exact: true })
  ).toBeVisible()
  await expect(page.getByText("@demo_disabled", { exact: true })).toBeVisible()
  await expect(page.getByText("login_required", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Demo data only. Notifications are disabled.")
  ).toBeVisible()
  await expect(
    page.getByRole("img", { name: /Fallback successes/ })
  ).toBeVisible()
  const statuses = page.getByRole("group", {
    name: "Filter Instagram accounts by status",
  })
  await statuses.getByRole("button", { name: /Dead/ }).click()
  await expect(page.getByText("@demo_account", { exact: true })).toHaveCount(0)
  await expect(page.getByText("@demo_disabled", { exact: true })).toBeVisible()
  await statuses.getByRole("button", { name: /Cooling down/ }).click()
  await expect(page.getByText("No accounts match this filter.")).toBeVisible()
  await statuses.getByRole("button", { name: /All/ }).click()
  await expect(page.getByText("@demo_account", { exact: true })).toBeVisible()
  if (!isMobile) {
    for (const width of [1030, 1190]) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
  }
  const period = page.getByRole("group", { name: "Fallback period" })
  await period.getByRole("button", { name: "Last 7 days" }).click()
  await expect(
    period.getByRole("button", { name: "Last 7 days" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", { name: "Refresh accounts" })
  ).toBeEnabled()
  await page.getByRole("button", { name: "Refresh accounts" }).click()
  await expect(
    page.getByRole("button", { name: "Refresh accounts" })
  ).toBeEnabled()
  await page.screenshot({
    path: testInfo.outputPath("scraper-accounts.png"),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})
