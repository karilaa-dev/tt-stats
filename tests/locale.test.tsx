// @vitest-environment jsdom
import { act } from "react"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { locales, resolveLocale } from "@/lib/i18n/locale"
import { LocaleProvider, LanguageSelector, T } from "@/lib/i18n/provider"
import { translate } from "@/lib/i18n/translate"
import { messages } from "@/lib/i18n/messages"
import { otherDownloaders } from "@/lib/i18n/format"
import { CardTitle } from "@/components/controls"
import { ExactCounter } from "@/components/dashboard/exact-counter"
afterEach(cleanup)
it("resolves the first supported browser language and validates cookie overrides", () => {
  expect(resolveLocale(undefined, "de-DE,uk-UA;q=0.9,ru;q=0.8,en;q=0.7")).toBe(
    "uk"
  )
  expect(resolveLocale("ru", "uk-UA")).toBe("ru")
  expect(resolveLocale("fr", "ru-RU")).toBe("ru")
  expect(resolveLocale("<script>", "ru;q=0,uk;q=oops,de")).toBe("en")
})
it("has nonempty Russian and Ukrainian translations for every typed English key", () => {
  for (const [key, translations] of Object.entries(messages))
    for (const locale of locales.filter((l) => l !== "en")) {
      expect(translations[locale].trim(), key).not.toBe("")
      expect(translate(key, locale), key).toBe(translations[locale])
    }
  expect(translate("My Profile · @ttgrab Stats", "uk")).toBe(
    "Мій профіль · @ttgrab Stats"
  )
})
it("hydrates the server locale without a language mismatch and remembers an explicit selection", async () => {
  document.documentElement.dataset.pageTitle = "My Profile · @ttgrab Stats"
  const app = (
    <LocaleProvider initialLocale="uk">
      <LanguageSelector />
      <h1>
        <T>My Profile</T>
      </h1>
      <ExactCounter value="9007199254740993123456" />
    </LocaleProvider>
  )
  const html = renderToString(app)
  expect(html).toContain("Мій профіль")
  const div = document.createElement("div")
  document.body.append(div)
  div.innerHTML = html
  const recover = vi.fn()
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(div, app, { onRecoverableError: recover })
  })
  expect(recover).not.toHaveBeenCalled()
  expect(div.textContent).toContain(
    BigInt("9007199254740993123456").toLocaleString("uk")
  )
  fireEvent.click(screen.getByRole("combobox", { name: "Мова сайту" }))
  const russian = await screen.findByRole("option", { name: "Русский" })
  fireEvent.pointerDown(russian, { pointerType: "mouse" })
  fireEvent.click(russian)
  expect(screen.getByRole("heading").textContent).toBe("Мой профиль")
  expect(document.cookie).toContain("tt_stats_locale=ru")
  expect(document.documentElement.lang).toBe("ru")
  expect(document.title).toBe("Мой профиль · @ttgrab Stats")
  await act(async () => root!.unmount())
  div.remove()
})
it("uses plural forms without rounding large counts", () => {
  expect(otherDownloaders(1n, "ru")).toContain("пользователь скачал")
  expect(otherDownloaders(2n, "ru")).toContain("пользователя скачали")
  expect(otherDownloaders(11n, "uk")).toContain("користувачів")
  expect(otherDownloaders(21n, "uk")).toContain("користувач завантажив")
  expect(otherDownloaders(900719925474099321n, "uk")).toContain(
    "користувач завантажив"
  )
})

it("leaves a database-supplied display name unchanged even if it matches a translated label", () => {
  const html = renderToString(
    <LocaleProvider initialLocale="ru">
      <CardTitle>Overview</CardTitle>
      <p>
        <T>Overview</T>
      </p>
    </LocaleProvider>
  )
  expect(html).toContain(">Overview</h2>")
  expect(html).toContain(">Обзор</p>")
})
