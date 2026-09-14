import { expect, test } from "@playwright/test"

test("personal statistics, filters, mobile access, and logout", async ({
  page,
  playwright,
  baseURL,
  isMobile,
}, testInfo) => {
  // Browser presentation uses a simulated Telegram session. Real session identity,
  // ownership, and JWT verification are tested at the server boundary separately.
  const backend = await playwright.request.newContext({ baseURL })
  await backend.post("/api/admin-session", {
    data: { token: "test-admin-secret-with-at-least-32-characters" },
    headers: { origin: baseURL! },
  })
  let signedIn = true
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
    await expect(page).toHaveTitle("My Profile · TT Stats")
    const history = page.getByRole("list", { name: "Download history" })
    await expect(history.getByText("You were first").first()).toBeVisible()
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
    await expect(page.getByText("English", { exact: true })).toBeVisible()
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
