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
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0)

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
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
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

test("branding, reduced motion and compact navigation", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  if (isMobile) await page.setViewportSize({ width: 320, height: 740 })
  await page.goto("/dashboard")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(page).toHaveTitle(/@ttgrab Stats/)
  await expect(page.locator("html")).toHaveClass("dark")
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/favicon.svg"
  )
  await expect(page.locator('img[src="/ttgrab-logo.png"]:visible')).toHaveCount(
    1
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  const target = isMobile
    ? page.getByRole("button", { name: "Open all sections" })
    : page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Referrals", exact: true })
  await target.focus()
  await expect(target).toBeFocused()
  await page.keyboard.press("Enter")
  if (isMobile) {
    await expect(
      page.getByRole("dialog", { name: "All sections" })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(target).toBeFocused()
  } else {
    await expect(page).toHaveURL(/referrals/)
    await page.goto("/dashboard")
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  }
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: testInfo.outputPath("branding.png"),
    fullPage: true,
  })
})
