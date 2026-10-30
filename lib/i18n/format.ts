import type { Locale } from "./locale"
/** Count grammar uses the exact final digits even beyond Number.MAX_SAFE_INTEGER. */
export function otherDownloaders(count: bigint, locale: Locale): string {
  const formatted = count.toLocaleString(locale)
  if (locale === "en")
    return `${formatted} other ${count === 1n ? "person" : "people"} downloaded this`
  const rule = new Intl.PluralRules(locale).select(Number(count % 100n))
  const words =
    locale === "ru"
      ? {
          one: "другой пользователь скачал это",
          few: "других пользователя скачали это",
          many: "других пользователей скачали это",
          other: "других пользователей скачали это",
        }
      : {
          one: "інший користувач завантажив це",
          few: "інші користувачі завантажили це",
          many: "інших користувачів завантажили це",
          other: "інших користувачів завантажили це",
        }
  return `${formatted} ${words[rule as keyof typeof words] ?? words.other}`
}
export function formatDuration(ms: number, locale: Locale) {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  const part = (value: number, unit: "second" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "narrow",
    }).format(value)
  return seconds < 60
    ? part(seconds, "second")
    : `${part(Math.floor(seconds / 60), "minute")} ${part(seconds % 60, "second")}`
}
/** How often one account downloaded a post, shown when Popular merges repeats. */
export function timesDownloaded(
  count: bigint,
  locale: Locale,
  own: boolean
): string {
  const formatted = count.toLocaleString(locale)
  if (locale === "en")
    return own
      ? `You downloaded this ${formatted} ${count === 1n ? "time" : "times"}`
      : `Downloaded ${formatted} ${count === 1n ? "time" : "times"} by this chat`
  const rule = new Intl.PluralRules(locale).select(Number(count % 100n))
  const times =
    locale === "ru"
      ? { one: "раз", few: "раза", many: "раз", other: "раза" }
      : { one: "раз", few: "рази", many: "разів", other: "рази" }
  const word = times[rule as keyof typeof times] ?? times.other
  if (locale === "ru")
    return own
      ? `Вы скачали это ${formatted} ${word}`
      : `Этот чат скачал это ${formatted} ${word}`
  return own
    ? `Ви завантажили це ${formatted} ${word}`
    : `Цей чат завантажив це ${formatted} ${word}`
}
