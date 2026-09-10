import { expect, test } from "@playwright/test"

const token = "test-admin-secret-with-at-least-32-characters"

test("public stats and MAU load, Operations prompts before navigation", async ({
  page,
  isMobile,
}) => {
  await page.goto("/dashboard")
  await expect(
    page.getByText("Registered chats", { exact: true }).first()
  ).toBeVisible()
  await expect(page.getByText("Telegram MAU", { exact: false })).toBeVisible()
  await expect(page.getByText("28,430", { exact: true })).toBeVisible()
  if (isMobile)
    await page.getByRole("button", { name: "Open all sections" }).click()
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Operations", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Admin access", exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).not.toHaveURL(/\/jobs/)
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
  await expect(
    page.getByText("Controls disabled in fake-data mode")
  ).toBeHidden()
})

test("search asks for a token without querying user data beforehand", async ({
  page,
}) => {
  const privateRequests: string[] = []
  page.on("request", (request) => {
    if (/\/_actions\/getUser(Stats|Downloads)/u.test(request.url()))
      privateRequests.push(request.url())
  })
  await page.goto("/dashboard/users")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await page
    .getByRole("textbox", { name: "Telegram user or group ID" })
    .fill("123456789")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(
    page.getByRole("dialog", { name: "Admin access", exact: true })
  ).toBeVisible()
  expect(privateRequests).toEqual([])
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByText("Telegram chat profile")).toBeHidden()
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await page.getByLabel("Admin token", { exact: true }).fill(token)
  await page
    .getByRole("button", { name: "Unlock admin access", exact: true })
    .click()
  await expect(page.getByText("Telegram chat profile")).toBeVisible()
  expect(privateRequests.length).toBeGreaterThan(0)
  await page.reload()
  await expect(page.getByText("Telegram chat profile")).toBeVisible()
})

test("deep links prompt and hide private content", async ({ page }) => {
  for (const route of ["jobs", "users?id=123456789"]) {
    await page.goto(`/dashboard/${route}`)
    await expect(
      page.getByRole("dialog", { name: "Admin access", exact: true })
    ).toBeVisible()
    await expect(page.getByText("Telegram chat profile")).toBeHidden()
    await expect(
      page.getByText("Controls disabled in fake-data mode")
    ).toBeHidden()
  }
})

test("server denies every private action and CSV without a session", async ({
  request,
  baseURL,
}) => {
  for (const action of [
    "getUserStats",
    "getUserDownloads",
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
  ]) {
    const response = await request.post(`/_actions/${action}`, {
      data: {},
      headers: { origin: baseURL! },
    })
    expect(response.status(), action).toBe(401)
  }
  expect((await request.get("/api/users/123456789/history.csv")).status()).toBe(
    401
  )
  expect(
    (
      await request.post("/_actions/getOverview", {
        headers: { origin: baseURL! },
      })
    ).status()
  ).toBe(200)
  const wrong = await request.post("/api/admin-session", {
    data: { token: "wrong" },
    headers: { origin: baseURL! },
  })
  expect(wrong.status()).toBe(401)
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
  const write = await request.post("/_actions/requestStatsJobRun", {
    data: { dataset: "rolling_24h" },
    headers: { origin: baseURL! },
  })
  expect(await write.text()).toContain("disabled while fake data is active")
  expect(
    (
      await request.post("/_actions/startBotstat", {
        headers: { origin: baseURL! },
      })
    ).status()
  ).toBe(404)
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
