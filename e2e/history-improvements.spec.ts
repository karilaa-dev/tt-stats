import { expect, test } from "@playwright/test"
import { loginAsAdmin } from "./session-fixture"

test.describe("localization", () => {
  test.use({ locale: "uk-UA" })
  test("browser language, remembered choice, raw profile data and responsive history", async ({
    page,
    context,
    baseURL,
    isMobile,
  }, testInfo) => {
    await loginAsAdmin(context, baseURL!)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("/dashboard/me")
    await expect(page.locator("html")).toHaveAttribute("lang", "uk")
    await expect(page).toHaveTitle("Мій профіль · @ttgrab Stats")
    await expect(
      page.getByRole("heading", { name: "Мій профіль", exact: true })
    ).toBeVisible()
    const history = page.getByRole("list", {
      name: "Історія завантажень",
      exact: true,
    })
    await expect(history).toBeVisible()
    await expect(history.getByRole("listitem").first()).toContainText("1.2M")
    await expect(history.getByRole("listitem").first()).toContainText(
      "Вподобання"
    )
    const frame = await page.locator(".dashboard-main").boundingBox()
    const section = await page.locator(".profile-history").boundingBox()
    if (!isMobile) expect(section!.width / frame!.width).toBeGreaterThan(0.6)
    if (!isMobile) expect(section!.width / frame!.width).toBeLessThan(0.69)
    await page.getByRole("combobox", { name: "Мова сайту" }).click()
    await page.getByRole("option", { name: "Русский", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: "Мой профиль", exact: true })
    ).toBeVisible()
    await expect(page).toHaveTitle("Мой профиль · @ttgrab Stats")
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("lang", "ru")
    expect(
      (await context.cookies()).find((c) => c.name === "tt_stats_locale")?.value
    ).toBe("ru")
    await page.getByRole("tab", { name: "Популярные скачивания" }).click()
    await expect(
      page.getByRole("heading", { name: "Популярные скачивания", exact: true })
    ).toBeVisible()
    await page
      .getByRole("combobox", { name: "Порядок", exact: true })
      .selectOption("oldest")
    await expect(page).toHaveURL(/sort=oldest/)
    await expect(page).toHaveURL(/category=popular/)
    if (isMobile) await page.setViewportSize({ width: 320, height: 740 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    expect(
      await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)
    ).toContain("IBM Plex Sans")
    await page.screenshot({
      path: testInfo.outputPath("localized-history.png"),
      fullPage: true,
    })
    expect(errors).toEqual([])
  })
})

test("activity card headers and dimensions survive a delayed period change", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAsAdmin(context, baseURL!)
  let release: () => void = () => {}
  const wait = new Promise<void>((resolve) => (release = resolve))
  await page.route("**/_actions/getMyActivity/**", async (route) => {
    await wait
    await route.continue()
  })
  await page.goto("/dashboard/me")
  const card = page.locator(".profile-activity-card")
  await expect(card.getByText(/Downloads per day/)).toBeVisible()
  const before = await card.boundingBox()
  const header = await card.locator('[data-slot="card-header"]').boundingBox()
  await page.getByRole("button", { name: "90 days", exact: true }).click()
  await expect(card.getByText(/Downloads per week/)).toBeVisible()
  await expect(
    card.getByText(/UTC, including the current period/)
  ).toBeVisible()
  await expect(
    card.getByRole("button", {
      name: "Bar chart",
      exact: true,
      includeHidden: true,
    })
  ).toBeVisible()
  expect((await card.boundingBox())!.height).toBeCloseTo(before!.height, 0)
  expect(
    (await card.locator('[data-slot="card-header"]').boundingBox())!.y -
      (await card.boundingBox())!.y
  ).toBe(header!.y - before!.y)
  release()
  await expect(card).toHaveAttribute("aria-busy", "false")
  expect((await card.boundingBox())!.height).toBeCloseTo(before!.height, 0)
})

test("albums support arrows, keyboard, swipe, boundaries and close cleanup", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAsAdmin(context, baseURL!)
  await page.route("**/api/media/*", (route) =>
    route.fulfill({
      json: {
        items: [0, 1, 2].map((position) => ({
          position,
          mediaType: "photo",
          url: `/fixture-album/${position}.svg`,
        })),
        unavailableReason: null,
      },
    })
  )
  await page.route("**/fixture-album/*.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200" fill="red"/></svg>',
    })
  )
  await page.goto("/dashboard/me")
  const trigger = page.getByRole("button", { name: "View media" }).first()
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Saved media", exact: true })
  const viewer = dialog.getByRole("region", { name: "Saved media slideshow" })
  await expect(viewer.getByText("1 / 3")).toBeVisible()
  await expect(
    viewer.getByRole("button", { name: "Previous item" })
  ).toBeDisabled()
  await viewer.getByRole("button", { name: "Next item" }).click()
  await expect(viewer.getByText("2 / 3")).toBeVisible()
  await viewer.focus()
  await page.keyboard.press("ArrowRight")
  await expect(viewer.getByText("3 / 3")).toBeVisible()
  await expect(viewer.getByRole("button", { name: "Next item" })).toBeDisabled()
  await page.keyboard.press("ArrowRight")
  await expect(viewer.getByText("3 / 3")).toBeVisible()
  const stage = viewer.locator(".album-stage")
  const box = (await stage.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(viewer.getByText("2 / 3")).toBeVisible()
  await expect(viewer.locator("img")).toHaveCount(1)
  expect(
    await viewer.locator("img").evaluate((el) => getComputedStyle(el).objectFit)
  ).toBe("contain")
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(viewer.getByText("1 / 3")).toBeVisible()
})

test("public users have no rebuild control and cannot request either dataset", async ({
  page,
  baseURL,
}) => {
  await page.goto("/dashboard")
  await expect(page.getByRole("button", { name: "Update now" })).toHaveCount(0)
  for (const dataset of ["rolling_24h", "daily"]) {
    const response = await page.request.post("/_actions/requestStatsJobRun", {
      data: { dataset },
      headers: { origin: baseURL! },
    })
    expect(response.status()).toBe(401)
  }
})
