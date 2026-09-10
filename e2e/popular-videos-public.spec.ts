import { expect, test } from "@playwright/test"

test("visitors can browse every period and keep filters through pagination and history", async ({
  page,
  isMobile,
}) => {
  await page.goto("/dashboard")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  if (isMobile)
    await page.getByRole("button", { name: "Open all sections" }).click()
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Top videos", exact: true })
    .click()
  await expect(page).toHaveURL(/dashboard\/videos/)
  const table = page.getByRole("table", { name: "Most downloaded videos" })
  await expect(table).toBeVisible()
  await expect(
    page.getByRole("dialog", { name: "Admin access", exact: true })
  ).toHaveCount(0)
  for (const [label, range, count] of [
    ["24 hours", "24h", "12"],
    ["7 days", "7d", "36"],
    ["31 days", "31d", "72"],
    ["Total", "all", "120"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click()
    await expect(
      table.getByRole("row").nth(1).getByRole("cell").nth(2)
    ).toHaveText(count!)
    await expect(
      page.getByRole("button", { name: label, exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    if (range !== "24h")
      await expect(page).toHaveURL(new RegExp(`range=${range}`))
  }
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page).toHaveURL(/range=all&page=2/)
  await page.getByRole("button", { name: "7 days", exact: true }).click()
  await expect(page).toHaveURL(/range=7d&page=1/)
  await expect(
    table.getByRole("row").nth(1).getByRole("cell").first()
  ).toHaveText("1")
  await page.goBack()
  await expect(page).toHaveURL(/range=all&page=2/)
  await expect(
    table.getByRole("row").nth(1).getByRole("cell").first()
  ).toHaveText("21")
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Total", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(table).toBeVisible()
  await table.getByRole("button", { name: "View media" }).first().click()
  await expect(
    page.getByRole("dialog", { name: "Admin access", exact: true })
  ).toBeVisible()
})

test("ranking actions are public while saved media and downloader identities stay private", async ({
  request,
  baseURL,
}) => {
  for (const range of ["24h", "7d", "31d", "all"]) {
    expect(
      (
        await request.post("/_actions/getPopularVideos", {
          data: { page: 1, range },
          headers: { origin: baseURL! },
        })
      ).status()
    ).toBe(200)
  }
  expect(
    (
      await request.post("/_actions/getPopularVideos", {
        data: { page: 1, range: "90d" },
        headers: { origin: baseURL! },
      })
    ).status()
  ).toBe(400)
  for (const action of ["getDownloadMedia", "getDownloaders", "getUserStats"]) {
    expect(
      (
        await request.post(`/_actions/${action}`, {
          data: { downloadId: "9999", userId: "123456789", page: 1 },
          headers: { origin: baseURL! },
        })
      ).status()
    ).toBe(401)
  }
  expect((await request.get("/api/media/9999/0")).status()).toBe(401)
})
