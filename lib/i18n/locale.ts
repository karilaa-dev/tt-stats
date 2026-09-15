export const locales = ["en", "ru", "uk"] as const
export type Locale = (typeof locales)[number]
export const LOCALE_COOKIE = "tt_stats_locale"
export const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
}
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale)
}
export function resolveLocale(cookie?: string, acceptLanguage = ""): Locale {
  if (isLocale(cookie)) return cookie
  const candidates = acceptLanguage
    .split(",")
    .map((value, index) => {
      const [tag, ...parameters] = value.trim().split(";")
      const quality = parameters
        .find((p) => p.trim().startsWith("q="))
        ?.trim()
        .slice(2)
      const q = quality === undefined ? 1 : Number(quality)
      return { tag: tag.toLowerCase().split("-")[0], q, index }
    })
    .filter((item) => Number.isFinite(item.q) && item.q > 0 && item.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  return (candidates.find((item) => isLocale(item.tag))?.tag as Locale) ?? "en"
}
export function localeFromRequest(
  cookies: { get: (name: string) => { value: string } | undefined },
  request: Request
): Locale {
  return resolveLocale(
    cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language") ?? ""
  )
}
