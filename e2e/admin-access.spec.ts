import { expect, test } from "@playwright/test"
import { loginAsAdmin, seedTestSession } from "./session-fixture"

test("Telegram login replaces the token form and admin navigation follows the session", async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  await page.goto("/dashboard")
  await expect(page.locator(".telegram-login")).toBeInViewport()
  await expect(
    page.getByRole("link", { name: "Operations", exact: true })
  ).toHaveCount(0)
  await page.goto("/admin")
  await expect(
    page.getByRole("heading", { name: "Admin access", exact: true })
  ).toBeVisible()
  await expect(page.getByLabel("Admin token", { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Log in with Telegram", exact: true }).last()
  ).toHaveAttribute("href", "/api/auth/telegram/start")
  await loginAsAdmin(context, baseURL!)
  await page.goto("/dashboard/jobs")
  await expect(
    page.getByText("Controls disabled in fake-data mode")
  ).toBeVisible()
  if (isMobile)
    await page.getByRole("button", { name: "Open all sections" }).click()
  await expect(
    page.getByRole("link", { name: "Operations", exact: true }).last()
  ).toBeVisible()
  await page.goto("/dashboard/me")
  await page.getByRole("button", { name: "Log out", exact: true }).click()
  await expect(page.locator(".telegram-login").first()).toHaveText(
    "Log in with Telegram"
  )
  await page.goto("/dashboard/jobs")
  await expect(page).toHaveURL(/\/admin$/)
})

test("private deep links redirect before loading private data", async ({
  page,
}) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (
      /\/_actions\/(getUser|getStatsJobs|getTelegramChat)/u.test(request.url())
    )
      requests.push(request.url())
  })
  for (const path of ["/dashboard/users?id=123456789", "/dashboard/jobs"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("heading", { name: "Admin access", exact: true })
    ).toBeVisible()
  }
  expect(requests).toEqual([])
})

test("server authorization uses Telegram sessions and rejects the retired token endpoint", async ({
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
    "getMyActivity",
    "getUserActivity",
  ]) {
    expect(
      (
        await request.post(`/_actions/${action}`, {
          data: {},
          headers: { origin: baseURL! },
        })
      ).status(),
      action
    ).toBe(401)
  }
  expect(
    (
      await request.post("/api/admin-session", {
        data: { token: "retired-token" },
        headers: { origin: baseURL! },
      })
    ).status()
  ).toBe(404)
  expect((await request.get("/api/users/123456789/history.csv")).status()).toBe(
    401
  )
  const token = await seedTestSession()
  const headers = { Cookie: `tt_stats_user=${token}`, origin: baseURL! }
  expect(
    (
      await request.get("/api/users/123456789/history.csv", { headers })
    ).status()
  ).toBe(200)
  expect((await request.get("/api/me/history.csv", { headers })).status()).toBe(
    200
  )
  expect(
    (
      await request.delete("/api/session", {
        headers: { ...headers, origin: "https://untrusted.example" },
      })
    ).status()
  ).toBe(403)
  expect((await request.delete("/api/session", { headers })).status()).toBe(200)
  expect(
    (
      await request.get("/api/users/123456789/history.csv", { headers })
    ).status()
  ).toBe(401)
  const other = await seedTestSession("456")
  expect(
    (
      await request.get("/api/users/123456789/history.csv", {
        headers: { Cookie: `tt_stats_user=${other}` },
      })
    ).status()
  ).toBe(401)
})

test("personal page explains cancelled and expired logins", async ({
  page,
}) => {
  for (const [status, message] of [
    ["cancelled", "Login was cancelled"],
    ["expired", "That login link expired"],
    ["unavailable", "Telegram login is temporarily unavailable"],
  ]) {
    await page.goto(`/dashboard/me?login=${status}`)
    await expect(page.getByRole("status")).toContainText(message)
    await expect(page.locator(".telegram-login").first()).toBeInViewport()
  }
})
