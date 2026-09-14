import { expect, test } from "@playwright/test"
const token = "test-admin-secret-with-at-least-32-characters"

test("login is visible and admin menus are hidden until visiting /admin", async ({
  page,
  isMobile,
}) => {
  await page.goto("/dashboard")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(page.locator(".telegram-login")).toBeInViewport()
  await expect(page.locator(".telegram-login")).toHaveText("My profile")
  await expect(
    page.getByRole("link", { name: "Operations", exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "User lookup", exact: true })
  ).toHaveCount(0)
  if (isMobile) {
    const dock = page.getByRole("navigation", { name: "Quick navigation" })
    await expect(
      dock.getByRole("link", { name: "My profile", exact: true })
    ).toBeInViewport()
    await expect(
      dock.getByRole("link", { name: "Videos", exact: true })
    ).toBeInViewport()
    await dock.getByRole("button", { name: "Open all sections" }).click()
    await expect(
      page.getByRole("link", { name: "Operations", exact: true })
    ).toHaveCount(0)
  }
  await page.goto("/admin")
  await page.getByLabel("Admin token", { exact: true }).fill("wrong-token")
  await page
    .getByRole("button", { name: "Unlock admin access", exact: true })
    .click()
  await expect(page.getByRole("alert")).toContainText("Incorrect admin token")
  await page.getByLabel("Admin token", { exact: true }).fill(token)
  await page
    .getByRole("button", { name: "Unlock admin access", exact: true })
    .click()
  await expect(page).toHaveURL(/\/dashboard\/jobs/)
  await expect(
    page.getByText("Controls disabled in fake-data mode")
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Lock admin access", exact: true })
    .click()
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByLabel("Admin token", { exact: true })).toBeVisible()
})

test("private page deep links redirect to /admin before querying private data", async ({
  page,
}) => {
  const privateRequests: string[] = []
  page.on("request", (request) => {
    if (
      /\/_actions\/(getUser|getStatsJobs|getTelegramChat)/u.test(request.url())
    )
      privateRequests.push(request.url())
  })
  for (const path of ["/dashboard/users?id=123456789", "/dashboard/jobs"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByLabel("Admin token", { exact: true })).toBeVisible()
    await expect(page.getByText("Download statistics")).toHaveCount(0)
  }
  expect(privateRequests).toEqual([])
})

test("server denies private actions and exports without the correct session", async ({
  request,
  baseURL,
}) => {
  for (const action of [
    "getTelegramChat",
    "getUserStats",
    "getUserDownloads",
    "getDownloaders",
    "getStatsJobs",
    "getDatabaseSetupStatus",
    "configureDatabaseJobs",
    "updateDatabaseDefinitions",
    "getStatsJobRuns",
    "updateStatsJobSchedule",
    "setStatsJobActive",
    "requestStatsJobRun",
    "getManualRefreshRequest",
    "getVideoNotificationStatus",
    "sendVideoNotificationTest",
    "getMyStats",
    "getMyDownloads",
  ]) {
    const response = await request.post(`/_actions/${action}`, {
      data: {},
      headers: { origin: baseURL! },
    })
    expect(response.status(), action).toBe(401)
  }
  for (const route of [
    "/api/users/123456789/history.csv",
    "/api/me/history.csv",
  ])
    expect((await request.get(route)).status()).toBe(401)
  const popular = await request.post("/_actions/getDownloadMedia", {
    data: { downloadId: "10000" },
    headers: { origin: baseURL! },
  })
  expect(popular.status()).toBe(200)
  const privateMedia = await request.post("/_actions/getDownloadMedia", {
    data: { downloadId: "1" },
    headers: { origin: baseURL! },
  })
  expect(privateMedia.status()).toBe(404)
  const publicAudience = await request.post("/_actions/getOtherStats", {
    headers: { origin: baseURL! },
  })
  expect(await publicAudience.text()).not.toContain("9007199254740993")
  const login = await request.post("/api/admin-session", {
    data: { token },
    headers: { origin: baseURL! },
  })
  expect(login.status()).toBe(200)
  expect(login.headers()["set-cookie"]).toContain("HttpOnly")
  expect(login.headers()["set-cookie"]).toContain("SameSite=Strict")
  expect(login.headers()["set-cookie"]).not.toContain(token)
  expect((await request.get("/api/users/123456789/history.csv")).status()).toBe(
    200
  )
  // Admin access does not invent a Telegram identity.
  expect((await request.get("/api/me/history.csv")).status()).toBe(401)
  expect(
    (
      await request.delete("/api/admin-session", {
        headers: { origin: "https://untrusted.example" },
      })
    ).status()
  ).toBe(403)
  await request.delete("/api/admin-session", { headers: { origin: baseURL! } })
  expect((await request.get("/api/users/123456789/history.csv")).status()).toBe(
    401
  )
})

test("personal page explains login and cancelled or expired attempts", async ({
  page,
}) => {
  for (const [status, message] of [
    ["cancelled", "Login was cancelled"],
    ["expired", "That login link expired"],
    ["unavailable", "Telegram login is temporarily unavailable"],
  ]) {
    await page.goto(`/dashboard/me?login=${status}`)
    await expect(
      page.getByRole("heading", { name: "My videos", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("status")).toContainText(message)
    await expect(page.locator(".telegram-login").first()).toBeInViewport()
    await expect(
      page.getByRole("link", { name: "Operations", exact: true })
    ).toHaveCount(0)
  }
})
