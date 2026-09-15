import { seedTestSession } from "./session-fixture"
import { expect, test } from "@playwright/test"
test.use({ timezoneId: "America/New_York" })

test("personal statistics, filters, mobile access, and logout", async ({
  page,
  playwright,
  baseURL,
  isMobile,
}, testInfo) => {
  // Browser presentation uses a simulated Telegram session. Real session identity,
  // ownership, and JWT verification are tested at the server boundary separately.
  const token = await seedTestSession()
  const backend = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: `tt_stats_user=${token}` },
  })
  let signedIn = true
  const historyRequests: Record<string, unknown>[] = []
  await page.route("**/api/session", (route) => {
    if (route.request().method() === "DELETE") signedIn = false
    return route.fulfill({
      json: {
        user: signedIn
          ? { id: "123456789", name: "Alex Example", username: "alex_example" }
          : null,
        admin: false,
        loginAvailable: true,
      },
    })
  })
  await page.route("**/_actions/getMyStats/**", async (route) => {
    const response = await backend.post("/_actions/getUserStats", {
      data: { userId: "123456789" },
      headers: { origin: baseURL! },
    })
    await route.fulfill({ response })
  })
  await page.route("**/_actions/getMyDownloads/**", async (route) => {
    historyRequests.push(route.request().postDataJSON())
    const response = await backend.post("/_actions/getUserDownloads", {
      data: { ...route.request().postDataJSON(), userId: "123456789" },
      headers: { origin: baseURL! },
    })
    await route.fulfill({ response })
  })
  await page.route("**/_actions/getMyActivity/**", async (route) => {
    const response = await backend.post("/_actions/getUserActivity", {
      data: { ...route.request().postDataJSON(), userId: "123456789" },
      headers: { origin: baseURL! },
    })
    await route.fulfill({ response })
  })
  try {
    await page.goto("/dashboard/me")
    await expect(page.getByText("Alex Example", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "My Profile", exact: true })
    ).toBeVisible()
    await expect(page.locator(".telegram-login")).toHaveText("My Profile")
    await expect(page).toHaveTitle("My Profile · @ttgrab Stats")
    const history = page.getByRole("list", { name: "Download history" })
    await expect(
      page.getByRole("group", { name: "History period", exact: true })
    ).toHaveCount(0)
    await expect(history.getByText("You were first").first()).toBeVisible()
    await expect(
      history
        .getByRole("listitem")
        .nth(3)
        .getByRole("button", { name: "View media" })
    ).toHaveCount(0)
    await expect(
      history
        .getByRole("listitem")
        .nth(4)
        .getByRole("button", { name: "View media" })
    ).toHaveCount(0)
    const savedOnly = page.getByRole("switch", { name: "Show only records with media preview" })
    await savedOnly.click()
    await expect(savedOnly).toBeChecked()
    await expect(page).toHaveURL(/savedMediaOnly=true/)
    await expect(history.getByRole("listitem")).toHaveCount(17)
    await expect(
      history.getByRole("button", { name: "View media" })
    ).toHaveCount(17)
    await expect
      .poll(() => historyRequests.at(-1))
      .toMatchObject({ savedMediaOnly: true, page: 1 })
    await page.reload()
    await expect(savedOnly).toBeChecked()
    await expect(history.getByRole("listitem")).toHaveCount(17)
    await page.goBack()
    await expect(savedOnly).not.toBeChecked()
    await expect(history.getByRole("listitem")).toHaveCount(20)
    await expect(
      history.getByText(/other people downloaded this/).first()
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Other downloaders", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Operations", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Export full history" })
    ).toHaveAttribute("href", "/api/me/history.csv")
    if (isMobile)
      await expect(
        page
          .getByRole("navigation", { name: "Quick navigation" })
          .getByRole("link", { name: "My Profile" })
      ).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await expect(page.locator(".profile-summary").getByText(/English/)).toBeVisible()
    const summary = await page.locator(".profile-summary").boundingBox()
    const chart = await page.locator(".profile-activity-card").boundingBox()
    if (isMobile) {
      expect(chart!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height)
    } else {
      expect(chart!.x).toBeGreaterThan(summary!.x + summary!.width)
      expect(Math.abs(chart!.y - summary!.y)).toBeLessThan(2)
    }
    await expect(
      page.getByText("No other people have downloaded this yet")
    ).toHaveCount(0)
    const activityPeriod = page.getByRole("group", {
      name: "Activity period",
      exact: true,
    })
    await activityPeriod
      .getByRole("button", { name: "All time", exact: true })
      .click()
    await expect(page.getByText(/Downloads per month/)).toBeVisible()
    await expect(
      page
        .getByRole("group", { name: "Activity period", exact: true })
        .getByRole("button", { name: "All time", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await page
      .getByRole("group", { name: "Activity period", exact: true })
      .getByRole("button", { name: "90 days", exact: true })
      .click()
    await expect(page.getByText(/Downloads per week/)).toBeVisible()
    await page
      .getByRole("group", { name: "Activity period", exact: true })
      .getByRole("button", { name: "31 days", exact: true })
      .click()
    await page
      .getByRole("button", { name: "View media", exact: true })
      .first()
      .click()
    await expect(
      page.getByRole("dialog", { name: "Saved media" })
    ).toContainText("Saved media is unavailable in demo mode.")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "Saved media" })).toBeHidden()
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur()
      window.scrollTo(0, 0)
    })
    await page.screenshot({
      path: testInfo.outputPath("my-profile-light.png"),
    })
    await page.evaluate(() => document.documentElement.classList.add("dark"))
    if (isMobile) await page.setViewportSize({ width: 320, height: 720 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("my-profile-dark.png") })
    await history.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath("my-history-dark.png") })
    await page
      .getByRole("form", { name: "History date range" })
      .scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath("history-filters-dark.png"),
    })
    if (isMobile) await page.setViewportSize({ width: 393, height: 851 })
    await page.evaluate(() => document.documentElement.classList.remove("dark"))
    await page
      .getByRole("group", { name: "Media type", exact: true })
      .getByRole("button", { name: "Albums", exact: true })
      .click()
    await expect(page).toHaveURL(/mediaKind=images/)
    await expect(history.getByRole("listitem")).toHaveCount(5)
    await page.goBack()
    await expect(history.getByRole("listitem")).toHaveCount(20)
    await page.getByRole("button", { name: "Go to next page" }).click()
    await expect(history.getByRole("listitem")).toHaveCount(7)
    await page.getByLabel("From date", { exact: true }).fill("2026-08-09")
    await page.getByLabel("Through date", { exact: true }).fill("2026-08-09")
    await page.getByRole("button", { name: "Apply dates", exact: true }).click()
    await expect(page).toHaveURL(/page=1/)
    await expect(history.getByRole("listitem")).toHaveCount(6)
    await expect
      .poll(() => historyRequests.at(-1))
      .toMatchObject({
        from: Date.parse("2026-08-09T04:00:00Z") / 1000,
        until: Date.parse("2026-08-10T04:00:00Z") / 1000,
        page: 1,
      })
    await expect(
      page.getByText("Dates in America/New_York. Includes the full end date.")
    ).toBeVisible()
    await page.getByRole("button", { name: "Clear dates" }).click()
    await expect(history.getByRole("listitem")).toHaveCount(20)
    for (const [date, from, until] of [
      ["2026-03-08", "2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z"],
      ["2026-11-01", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z"],
    ]) {
      await page.getByLabel("From date", { exact: true }).fill(date!)
      await page.getByLabel("Through date", { exact: true }).fill(date!)
      await page
        .getByRole("button", { name: "Apply dates", exact: true })
        .click()
      await expect
        .poll(() => historyRequests.at(-1))
        .toMatchObject({
          from: Date.parse(from!) / 1000,
          until: Date.parse(until!) / 1000,
        })
      await expect(
        page.getByText("No downloads found", { exact: true })
      ).toBeVisible()
    }
    await page.getByRole("button", { name: "Clear dates" }).click()
    await expect(history.getByRole("listitem")).toHaveCount(20)
    await page.getByLabel("From date", { exact: true }).fill("2026-08-11")
    await page.getByLabel("Through date", { exact: true }).fill("2026-08-10")
    const requestCount = historyRequests.length
    await page.getByRole("button", { name: "Apply dates", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText(
      "The end date must be on or after the start date."
    )
    expect(historyRequests).toHaveLength(requestCount)
    await page.getByRole("button", { name: "Clear dates" }).click()
    await page
      .getByRole("combobox", { name: "Show", exact: true })
      .selectOption("others")
    await expect(
      page.getByRole("combobox", { name: "Sort", exact: true })
    ).toHaveValue("newest")
    await expect(
      page.getByText("Showing 1–20 of 23", { exact: true })
    ).toBeVisible()
    await expect(history.getByRole("listitem").first()).toContainText(
      "1 other person downloaded this"
    )
    await page.getByRole("button", { name: "Go to next page" }).click()
    await expect(history.getByRole("listitem")).toHaveCount(3)
    await page
      .getByRole("combobox", { name: "Show", exact: true })
      .selectOption("first")
    await expect(page).toHaveURL(/page=1/)
    await expect(history.getByRole("listitem")).toHaveCount(6)
    for (const row of await history.getByRole("listitem").all()) {
      await expect(row).toContainText("You were first")
      await expect(row).toContainText(/other (people|person) downloaded this/)
    }
    await page
      .getByRole("combobox", { name: "Sort", exact: true })
      .selectOption("newest")
    await expect(history.getByRole("listitem").first()).toContainText(
      "4 other people downloaded this"
    )
    await page.getByRole("button", { name: "Log out", exact: true }).click()
    await expect(
      page.getByText("See your download history", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("list", { name: "Download history" })
    ).toHaveCount(0)
    await expect(page.getByText("Alex Example", { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "My Profile", exact: true })
    ).toBeVisible()
    for (const login of await page.locator(".telegram-login").all()) {
      await expect(login).toHaveText("Log in with Telegram")
      await expect(login).toHaveAttribute("href", "/api/auth/telegram/start")
      await expect(login).toBeVisible()
    }
    await expect(page.getByText("My videos", { exact: true })).toHaveCount(0)
    if (isMobile) {
      await expect(
        page
          .getByRole("navigation", { name: "Quick navigation" })
          .getByRole("link", { name: "My Profile", exact: true })
      ).toBeInViewport()
      await page.setViewportSize({ width: 320, height: 720 })
      await expect(page.locator(".telegram-login-compact")).toBeInViewport()
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  } finally {
    await backend.dispose()
  }
})
