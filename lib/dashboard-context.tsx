import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react"
import { parseChatScope, parseStatsRange } from "@/lib/stats/validation"

export const DashboardContext = createContext({
  pathname: "/dashboard",
  search: "",
  fakeMode: false,
})
export const useDashboardContext = () => useContext(DashboardContext)
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback)
  return () => window.removeEventListener("popstate", callback)
}
const browserSearch = () => window.location.search
function parseSearch(search: string) {
  const params = new URLSearchParams(search)
  const page = Number(params.get("page"))
  return {
    range: parseStatsRange(params.get("range")),
    scope: parseChatScope(params.get("scope")),
    id: params.get("id") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}
export function useDashboardSearch() {
  const { search } = useDashboardContext()
  return parseSearch(
    useSyncExternalStore(subscribe, browserSearch, () => search)
  )
}
type Search = ReturnType<typeof parseSearch>
export function useDashboardNavigate() {
  return useCallback(
    async ({
      search,
      replace = false,
    }: {
      search: Partial<Search> | ((previous: Search) => Partial<Search>)
      replace?: boolean
    }) => {
      const next =
        typeof search === "function"
          ? search(parseSearch(window.location.search))
          : search
      const url = new URL(window.location.href)
      url.search = ""
      for (const [key, value] of Object.entries(next))
        if (value !== "") url.searchParams.set(key, String(value))
      if (url.href === window.location.href) return
      window.history[replace ? "replaceState" : "pushState"](null, "", url)
      window.dispatchEvent(new PopStateEvent("popstate"))
    },
    []
  )
}
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
