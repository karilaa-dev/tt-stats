// @vitest-environment jsdom

import { act } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"

const epoch = Date.parse("2026-08-12T00:00:00Z") / 1000
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

function TimeExample() {
  const settings = useBrowserTime()
  return (
    <span>{`${settings.timeZone}: ${formatTimestamp(epoch, settings)}`}</span>
  )
}

describe("browser timezone hydration", () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) {
      act(() => root?.unmount())
      root = undefined
    }
  })

  it("hydrates from the UTC fallback without a mismatch warning", async () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(<TimeExample />)
    expect(container.textContent).toContain("UTC:")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      root = hydrateRoot(container, <TimeExample />)
    })

    expect(consoleError).not.toHaveBeenCalled()
    expect(container.textContent).toContain(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    )
  })
})
