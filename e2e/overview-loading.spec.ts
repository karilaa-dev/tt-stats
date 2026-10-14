import { expect, test } from "@playwright/test"

test("overview arrives server-rendered without waiting for browser requests", async ({
  page,
}) => {
  const requests: string[] = []
  page.on("request", (request) => {
    const action = new URL(request.url()).pathname.match(/\/_actions\/(\w+)/)
    if (action) requests.push(action[1]!)
  })
  const response = await page.goto("/dashboard")
  const html = await response!.text()
  // Totals, traffic, and Telegram MAU are part of the first response.
  expect(html).toContain("Daily activity")
  expect(html).toContain("28,430")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(page.getByText("Daily activity", { exact: true })).toBeVisible()
  await expect(page.getByRole("figure")).toBeVisible()
  await expect(page.getByLabel("Loading monthly active users")).toHaveCount(0)
  await page.getByRole("tab", { name: "Groups", exact: true }).click()
  await expect(page.getByText("14,797", { exact: true })).toBeVisible()
  expect(
    requests.filter((name) =>
      ["getOverview", "getTimeSeries", "getTelegramMau"].includes(name)
    )
  ).toEqual([])
})
