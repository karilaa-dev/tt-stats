import { expect, test } from "@playwright/test"

const dashboardRoutes = [
  "/dashboard/",
  "/dashboard/detailed",
  "/dashboard/analytics",
]

const periodOptions = [
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "31 days", value: "31d" },
  { label: "All time", value: "all" },
]

for (const route of dashboardRoutes) {
  test(`${route} stays within the viewport`, async ({ page }) => {
    await page.goto(route)

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth)
  })
}

for (const route of ["/dashboard/detailed", "/dashboard/analytics"]) {
  test(`${route} period selector is visible and interactive`, async ({
    page,
  }) => {
    await page.goto(route)
    const selector = page.getByRole("group", { name: "Statistics period" })
    await expect(selector.getByRole("button")).toHaveCount(4)

    for (const option of periodOptions) {
      const button = selector.getByRole("button", {
        name: option.label,
        exact: true,
      })

      await expect(button).toBeInViewport()
      await button.click()
      await expect(page).toHaveURL(
        new RegExp(`[?&]range=${option.value}(?:&|$)`)
      )
      await expect(button).toHaveAttribute("aria-pressed", "true")
    }
  })
}
