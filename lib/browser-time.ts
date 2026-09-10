import { useEffect, useState } from "react"

export interface BrowserTimeSettings {
  locale: string
  timeZone: string
}

const serverFallback: BrowserTimeSettings = {
  locale: "en-GB",
  timeZone: "UTC",
}

// A chart formats many epochs with the same options. Bound the shared cache
// because server rendering can encounter different visitor locales.
const formatters = new Map<string, Intl.DateTimeFormat>()
const MAX_FORMATTERS = 32

export function useBrowserTime(): BrowserTimeSettings {
  const [settings, setSettings] = useState(serverFallback)

  useEffect(() => {
    setSettings({
      locale: navigator.language || serverFallback.locale,
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        serverFallback.timeZone,
    })
  }, [])

  return settings
}

export function formatEpoch(
  epoch: number,
  settings: BrowserTimeSettings,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const resolvedOptions = {
    timeZone: settings.timeZone,
    ...options,
  }
  const key = JSON.stringify([
    settings.locale,
    Object.entries(resolvedOptions)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  ])
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(settings.locale, resolvedOptions)
    if (formatters.size >= MAX_FORMATTERS) {
      formatters.delete(formatters.keys().next().value!)
    }
    formatters.set(key, formatter)
  }
  return formatter.format(epoch * 1000)
}

export function formatTimestamp(
  epoch: number,
  settings: BrowserTimeSettings
): string {
  return formatEpoch(epoch, settings, {
    dateStyle: "medium",
    timeStyle: "medium",
  })
}

export function formatChartBucket(
  epoch: number,
  range: "24h" | "7d" | "31d" | "all",
  settings: BrowserTimeSettings,
  includeZone = false
): string {
  return formatEpoch(epoch, settings, {
    month: "short",
    day: "2-digit",
    ...(range === "all" ? { year: "numeric" } : {}),
    ...(range === "24h" || range === "7d"
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
    ...(includeZone ? { timeZoneName: "short" } : {}),
  })
}
