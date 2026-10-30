import { expect, test } from "@playwright/test"

test("platform views preserve filters, reloads, and browser history", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/dashboard/detailed?scope=groups&range=7d")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  const platforms = page.getByRole("group", {
    name: "Download platform",
    exact: true,
  })
  await expect(
    platforms.getByRole("button", { name: "All platforms", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("Registered chats", { exact: true })
  ).toBeVisible()
  await platforms.getByRole("button", { name: "TikTok", exact: true }).click()
  await expect(page).toHaveURL(/platform=tiktok/)
  await expect(
    page.getByRole("heading", { name: "TikTok · Groups", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("TikTok downloads", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Music downloads", { exact: true })).toBeVisible()
  await expect(page.getByText("Registered chats", { exact: true })).toBeHidden()
  await platforms
    .getByRole("button", { name: "Instagram", exact: true })
    .click()
  await expect(
    page.getByText("Instagram downloads", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Music downloads", { exact: true })).toBeHidden()
  expect(new URL(page.url()).searchParams.get("range")).toBe("7d")
  expect(new URL(page.url()).searchParams.get("scope")).toBe("groups")
  await page.reload()
  await expect(
    platforms.getByRole("button", { name: "Instagram", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("Instagram downloads", { exact: true })
  ).toBeVisible()
  await page.goBack()
  await expect(
    platforms.getByRole("button", { name: "TikTok", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("TikTok downloads", { exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  expect(errors).toEqual([])
})

test("platform selection is server rendered and localized without overflow", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "tt_stats_locale", value: "uk", url: baseURL! },
  ])
  await page.goto("/dashboard/detailed?platform=instagram&range=31d&scope=all")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(
    page.getByText("Завантаження з Instagram", { exact: true })
  ).toBeVisible()
  await expect(
    page
      .getByRole("group", { name: "Платформа завантажень", exact: true })
      .getByRole("button", { name: "Instagram", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await page.setViewportSize({ width: 360, height: 800 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
})

test("switching platforms clears earlier counts while the next snapshot loads", async ({
  page,
}) => {
  await page.goto("/dashboard/detailed?platform=tiktok")
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0)
  await expect(
    page.getByText("TikTok downloads", { exact: true })
  ).toBeVisible()
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/_actions/getStatsBreakdown/**", async (route) => {
    await gate
    await route.continue()
  })
  const request = page.waitForRequest(
    (request) =>
      request.url().includes("/_actions/getStatsBreakdown") &&
      request.method() === "POST"
  )
  await page
    .getByRole("group", { name: "Download platform", exact: true })
    .getByRole("button", { name: "Instagram", exact: true })
    .click()
  await request
  try {
    await expect(
      page.getByRole("heading", { name: "Instagram · All chats", exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("status", {
        name: "Loading the latest statistics",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByText("TikTok downloads", { exact: true })
    ).toBeHidden()
    await expect(
      page.getByText("Instagram downloads", { exact: true })
    ).toBeHidden()
  } finally {
    release()
  }
  await expect(
    page.getByText("Instagram downloads", { exact: true })
  ).toBeVisible()
})
