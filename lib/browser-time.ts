import { useEffect, useState } from "react"

export interface BrowserTimeSettings {
  locale: string
  timeZone: string
}

const serverFallback: BrowserTimeSettings = {
  locale: "en-GB",
  timeZone: "UTC",
}

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
  return new Intl.DateTimeFormat(settings.locale, {
    timeZone: settings.timeZone,
    ...options,
  }).format(new Date(epoch * 1000))
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
    ...(range === "24h" || range === "7d"
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
    ...(includeZone ? { timeZoneName: "short" } : {}),
  })
}
