import { expect, test } from "@playwright/test"

test("every Astro dashboard route loads without browser errors", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  for (const [route, title, content] of [
    ["", "Overview", "Registered chats"],
    ["analytics", "Analytics", "Cache performance"],
    ["detailed", "Detailed statistics", "Cache misses"],
    ["users", "User lookup", "Enter an ID to begin"],
    ["referrals", "Referrals", "Referral ranking"],
    ["other", "Other statistics", "Top downloaders"],
    ["jobs", "Database jobs", "Controls disabled in fake-data mode"],
  ]) {
    await page.goto(`/dashboard/${route}`)
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: title, exact: true })
    ).toBeVisible()
    await expect(page.getByText(content, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("main")).toHaveCount(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  }
  expect(errors).toEqual([])
})

test("overview switches between users and groups", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(page.getByText("92,480", { exact: true })).toBeAttached()
  await page.getByRole("tab", { name: "Groups", exact: true }).click()
  await expect(page.getByText("14,797", { exact: true })).toBeAttached()
})

test("lookup, pagination, CSV and browser history work", async ({ page }) => {
  await page.goto("/dashboard/users")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  const input = page.getByRole("textbox", { name: "Telegram user or group ID" })
  await input.fill("123456789")
  await expect(page).toHaveURL(/id=123456789/)
  await expect(page.getByText("Telegram chat profile")).toBeVisible()
  const csv = page.getByRole("button", { name: "Download CSV history" })
  await expect(csv).toHaveAttribute("href", "/api/users/123456789/history.csv")
  await page.getByRole("button", { name: "Go to next page" }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.goBack()
  await expect(page).toHaveURL(/page=1/)
  await input.fill("not-an-id")
  await expect(
    page.getByText("Invalid Telegram ID", { exact: true })
  ).toBeVisible()
})

test("filters restore with browser back", async ({ page }) => {
  await page.goto("/dashboard/detailed?scope=groups&range=24h")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  const period = page.getByRole("group", { name: "Statistics period" })
  await period.getByRole("button", { name: "7 days", exact: true }).click()
  await expect(page).toHaveURL(/range=7d/)
  await page.goBack()
  await expect(
    period.getByRole("button", { name: "24 hours", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page).toHaveURL(/scope=groups/)
})

test("theme and responsive navigation work", async ({ page, isMobile }) => {
  await page.goto("/dashboard")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await page.getByRole("button", { name: "Choose theme" }).click()
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  if (isMobile)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Referrals", exact: true })
    .click()
  await expect(page).toHaveURL(/\/dashboard\/referrals/)
  await expect(page.locator("html")).toHaveClass(/dark/)
})

test("Astro endpoints validate input and disable demo writes", async ({
  request,
  baseURL,
}) => {
  const health = await request.get("/api/health")
  expect(await health.json()).toEqual({ status: "ok" })
  const csv = await request.get("/api/users/123456789/history.csv")
  expect(csv.headers()["content-type"]).toContain("text/csv")
  expect(await csv.text()).toContain("Time,Video")
  expect((await request.get("/api/users/invalid/history.csv")).status()).toBe(
    400
  )
  const invalid = await request.post("/_actions/getUserStats", {
    data: { userId: "invalid" },
    headers: { origin: baseURL! },
  })
  expect(invalid.status()).toBe(400)
  const write = await request.post("/_actions/requestStatsJobRun", {
    data: { dataset: "rolling_24h" },
    headers: { origin: baseURL! },
  })
  expect(write.status()).toBe(400)
  expect(await write.text()).toContain("disabled while fake data is active")
})
