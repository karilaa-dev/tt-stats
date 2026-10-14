import "@/lib/server-only"
import { currentDatabaseTask } from "@/lib/tasks/server"

interface Entry<T> {
  value: T
  expires: number
  size: number
}

/** A process-local LRU bounded by entry count and approximate payload bytes. */
export class MemoryLru<T> {
  readonly #entries = new Map<string, Entry<T>>()
  #bytes = 0

  constructor(
    readonly maxEntries: number,
    readonly maxBytes: number
  ) {}

  get size() {
    return this.#entries.size
  }

  get(key: string, now = Date.now()): Entry<T> | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= now) {
      this.delete(key)
      return undefined
    }
    // Reinsertion keeps Map iteration order equal to least-recent first.
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry
  }

  set(key: string, value: T, expires: number, size: number) {
    this.delete(key)
    if (expires <= Date.now() || size > this.maxBytes / 8) return
    this.#entries.set(key, { value, expires, size })
    this.#bytes += size
    while (this.#entries.size > this.maxEntries || this.#bytes > this.maxBytes)
      this.delete(this.#entries.keys().next().value!)
  }

  delete(key: string) {
    const entry = this.#entries.get(key)
    if (!entry) return
    this.#entries.delete(key)
    this.#bytes -= entry.size
  }

  clear() {
    this.#entries.clear()
    this.#bytes = 0
  }
}

/**
 * Waits for work shared between requests while honoring only the current
 * request's cancellation. Cancelling one waiter never cancels the shared work.
 */
export function awaitForCurrentTask<T>(promise: Promise<T>): Promise<T> {
  const signal = currentDatabaseTask()?.controller.signal
  if (!signal) return promise
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(
        signal.reason ?? new DOMException("Request cancelled", "AbortError")
      )
    signal.addEventListener("abort", abort, { once: true })
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort)
    })
  })
}
