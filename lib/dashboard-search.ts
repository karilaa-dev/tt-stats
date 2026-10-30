import {
  parseChatScope,
  parseDownloadPlatform,
  parseStatsRange,
} from "@/lib/stats/validation"

// Shared by server rendering and the browser so both derive identical filters
// and query keys from a URL.
export function parseDashboardSearch(search: string) {
  const params = new URLSearchParams(search)
  const page = Number(params.get("page"))
  return {
    range: parseStatsRange(params.get("range")),
    fromDate: params.get("fromDate") ?? "",
    throughDate: params.get("throughDate") ?? "",
    savedMediaOnly: params.get("savedMediaOnly") === "true",
    discovery: (["others", "first"].includes(params.get("discovery") ?? "")
      ? params.get("discovery")
      : "all") as "all" | "others" | "first",
    category: (params.get("category") === "popular" ||
    params.get("sort") === "popular"
      ? "popular"
      : "history") as "history" | "popular",
    sort: (params.get("sort") === "oldest" ? "oldest" : "newest") as
      "newest" | "oldest",
    mediaKind: (["video", "images", "audio"].includes(
      params.get("mediaKind") ?? ""
    )
      ? params.get("mediaKind")
      : "all") as "all" | "video" | "images" | "audio",
    scope: parseChatScope(params.get("scope")),
    platform: parseDownloadPlatform(params.get("platform")),
    id: params.get("id") ?? "",
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1_000_000) : 1,
  }
}
export type DashboardSearch = ReturnType<typeof parseDashboardSearch>

// Period and audience stay explicit so shared links keep their meaning.
const defaults: Partial<Record<keyof DashboardSearch, string>> = {
  savedMediaOnly: "false",
  discovery: "all",
  category: "history",
  sort: "newest",
  mediaKind: "all",
  platform: "all",
  page: "1",
}

/** Builds a canonical query string; default history filters and page 1 are omitted. */
export function dashboardSearchString(next: Partial<DashboardSearch>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === "") continue
    const text = String(value)
    if (defaults[key as keyof DashboardSearch] === text) continue
    params.set(key, text)
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}
