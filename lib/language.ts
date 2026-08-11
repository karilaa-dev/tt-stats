const languageCountries: Record<string, string> = {
  ar: "SA",
  az: "AZ",
  be: "BY",
  bg: "BG",
  cs: "CZ",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "GB",
  es: "ES",
  et: "EE",
  fa: "IR",
  fi: "FI",
  fr: "FR",
  he: "IL",
  hi: "IN",
  hu: "HU",
  hy: "AM",
  id: "ID",
  it: "IT",
  ja: "JP",
  ka: "GE",
  kk: "KZ",
  ko: "KR",
  lt: "LT",
  lv: "LV",
  nb: "NO",
  nl: "NL",
  nn: "NO",
  no: "NO",
  pl: "PL",
  pt: "PT",
  ro: "RO",
  ru: "RU",
  sk: "SK",
  sv: "SE",
  th: "TH",
  tr: "TR",
  uk: "UA",
  ur: "PK",
  uz: "UZ",
  vi: "VN",
  zh: "CN",
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" })

function countryFlag(country: string): string {
  return [...country.toUpperCase()]
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127_397))
    .join("")
}

export function getLanguagePresentation(value: string): {
  code: string
  flag: string
  name: string
} {
  const normalized = value.trim().replaceAll("_", "-")
  const [language = value, region] = normalized.split("-")
  const code = language.toLowerCase()
  const country =
    region && /^[a-z]{2}$/iu.test(region)
      ? region.toUpperCase()
      : languageCountries[code]

  let name = value || "Unknown"
  try {
    name = languageNames.of(code) ?? name
  } catch {
    // Preserve unusual values from the database instead of failing the table.
  }

  return {
    code: normalized || value,
    flag: country ? countryFlag(country) : "🌐",
    name,
  }
}
