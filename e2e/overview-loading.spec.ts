import { expect, test } from "@playwright/test"

test("overview starts independent requests before its totals arrive", async ({
  page,
}) => {
  let releaseOverview!: () => void
  const overviewPending = new Promise<void>((resolve) => {
    releaseOverview = resolve
  })
  const requests: string[] = []
  page.on("request", (request) => {
    const action = new URL(request.url()).pathname.match(/\/_actions\/(\w+)/)
    if (action) requests.push(action[1]!)
  })
  await page.route("**/_actions/getOverview/**", async (route) => {
    await overviewPending
    await route.continue()
  })

  try {
    await page.goto("/dashboard")
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
    await expect
      .poll(() => requests)
      .toEqual(
        expect.arrayContaining([
          "getOverview",
          "getTimeSeries",
          "getTelegramMau",
        ])
      )
  } finally {
    releaseOverview()
  }

  await expect(page.getByText("Daily activity", { exact: true })).toBeVisible()
  await expect(page.getByRole("figure")).toBeVisible()
  await expect(page.getByLabel("Loading monthly active users")).toHaveCount(0)
  await page.getByRole("tab", { name: "Groups", exact: true }).click()
  await expect(page.getByText("14,797", { exact: true })).toBeVisible()
  expect(requests.filter((name) => name === "getTimeSeries")).toHaveLength(1)
  expect(requests.filter((name) => name === "getTelegramMau")).toHaveLength(1)
})
