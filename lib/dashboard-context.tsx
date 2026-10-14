import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react"
import {
  dashboardSearchString,
  parseDashboardSearch as parseSearch,
  type DashboardSearch as Search,
} from "@/lib/dashboard-search"

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
export function useDashboardSearch() {
  const { search } = useDashboardContext()
  return parseSearch(
    useSyncExternalStore(subscribe, browserSearch, () => search)
  )
}
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
      url.search = dashboardSearchString(next)
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
