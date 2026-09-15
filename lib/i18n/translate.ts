import { messages } from "./messages"
import type { Locale } from "./locale"
const dictionary: Record<string, { ru: string; uk: string }> = messages
const patterns = Object.entries(dictionary)
  .filter(([key]) => /\{\d+\}/u.test(key))
  .map(([key, value]) => {
    const keys: string[] = []
    const expression = key
      .split(/(\{\d+\})/u)
      .map((part) => {
        if (/^\{\d+\}$/u.test(part)) {
          keys.push(part)
          return "(.+?)"
        }
        return part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      })
      .join("")
    return { regex: new RegExp(`^${expression}$`, "u"), value, keys }
  })
export function translate(text: string, locale: Locale): string {
  if (locale === "en" || !text.trim()) return text
  const normalized = text.trim().replace(/\s+/gu, " ")
  let result = dictionary[normalized]?.[locale]
  if (!result) {
    for (const { regex, value, keys } of patterns) {
      const match = normalized.match(regex)
      if (match) {
        result = value[locale].replace(/\{\d+\}/gu, (key) => {
          const captured = match[keys.indexOf(key) + 1]
          return captured ? (dictionary[captured]?.[locale] ?? captured) : key
        })
        break
      }
    }
  }
  if (!result) return text
  return `${text.match(/^\s*/u)?.[0] ?? ""}${result}${text.match(/\s*$/u)?.[0] ?? ""}`
}
