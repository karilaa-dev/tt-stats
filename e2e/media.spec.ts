import { expect, test } from "@playwright/test"

const token = "test-admin-secret-with-at-least-32-characters"

test.beforeEach(async ({ page, baseURL }) => {
  await page.request.post("/api/admin-session", {
    data: { token },
    headers: { origin: baseURL! },
  })
})

test("history opens media and links cache-hit downloads to other chats", async ({
  page,
}) => {
  await page.goto("/dashboard/users?id=123456789")
  const history = page.getByRole("table", {
    name: "Download history",
    exact: true,
  })
  await expect(history).toBeVisible()
  const rows = history.getByRole("row")
  await expect(
    rows.nth(1).getByRole("button", { name: "Other downloaders" })
  ).toHaveCount(0)
  await history.getByRole("button", { name: "View media" }).first().click()
  const media = page.getByRole("dialog", { name: "Saved media" })
  await expect(
    media.getByText("Saved media is unavailable in demo mode.")
  ).toBeVisible()
  await expect(
    media.getByRole("link", { name: "Open original post" })
  ).toHaveAttribute("href", /tiktok/)
  await page.keyboard.press("Escape")
  await history
    .getByRole("button", { name: "Other downloaders" })
    .first()
    .click()
  const others = page.getByRole("dialog", { name: "Other downloaders" })
  await expect(others.getByRole("table")).toBeVisible()
  await others.getByRole("link", { name: "9007199254740993" }).click()
  await expect(page).toHaveURL(/id=9007199254740993/)
  await expect(page.getByText("Saved bot records")).toBeVisible()
})

test("top videos show ranked counts and preserve page navigation", async ({
  page,
}) => {
  await page.goto("/dashboard/videos?range=all")
  const table = page.getByRole("table", { name: "Most downloaded videos" })
  await expect(table).toBeVisible()
  await expect(table.getByRole("row").nth(1)).toContainText("120")
  await expect(
    table.getByRole("columnheader", { name: "Unique chats" })
  ).toBeVisible()
  await table.getByRole("button", { name: "View media" }).first().click()
  await expect(page.getByRole("dialog", { name: "Saved media" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(
    table.getByRole("row").nth(1).getByRole("cell").first()
  ).toHaveText("21")
  await expect(
    page.getByRole("button", { name: "Next", exact: true })
  ).toBeDisabled()
  await page.getByRole("button", { name: "Previous", exact: true }).click()
  await expect(table).toBeVisible()
  await expect(page).toHaveURL(/page=1/)
  await page.goBack()
  await expect(
    table.getByRole("row").nth(1).getByRole("cell").first()
  ).toHaveText("21")
  await page.goto("/dashboard/videos?range=all&page=3")
  await expect(page.getByText("No videos found")).toBeVisible()
})

test("media endpoints reject invalid IDs and pages", async ({
  page,
  baseURL,
}) => {
  for (const downloadId of ["abc", "0", "9223372036854775808"]) {
    const response = await page.request.post("/_actions/getDownloadMedia", {
      data: { downloadId },
      headers: { origin: baseURL! },
    })
    expect(response.status()).toBe(400)
    expect(
      (await page.request.get(`/api/media/${downloadId}/0`)).status()
    ).toBe(400)
  }
  expect(
    (
      await page.request.post("/_actions/getPopularVideos", {
        data: { page: 0 },
        headers: { origin: baseURL! },
      })
    ).status()
  ).toBe(400)
})

test("an unbuilt ranking shows setup instructions without automatic retries", async ({
  page,
}) => {
  let requests = 0
  const routePattern = "**/_actions/getPopularVideos/**"
  await page.route(routePattern, async (route) => {
    requests += 1
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        type: "AstroActionError",
        code: "INTERNAL_SERVER_ERROR",
        message:
          "The TT Stats schema exists, but its initial rolling or daily refresh has not completed. Check the queued refreshes under Database jobs.",
      }),
    })
  })
  await page.goto("/dashboard/videos?range=all")
  await expect(page.getByRole("alert")).toContainText(
    "Statistics snapshots are not ready"
  )
  await expect(
    page.getByRole("link", { name: "Open Operations" })
  ).toHaveAttribute("href", "/dashboard/jobs")
  await expect(page.getByLabel("Loading top videos")).toHaveCount(0)
  expect(requests).toBe(1)
  await page.unroute(routePattern)
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    page.getByRole("table", { name: "Most downloaded videos" })
  ).toBeVisible()
  await expect(page.getByText(/Rankings update daily/)).toContainText(
    "Last updated"
  )
})
