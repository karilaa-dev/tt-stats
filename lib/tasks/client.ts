import {
  noteCooldown,
  requestWithCooldown,
  RequestCancelledError,
} from "@/lib/http-client"
import type { TaskProgress } from "./types"

export interface BrowserTask {
  id: string
  label: string
  started: number
  controller: AbortController
  progress?: TaskProgress
  cancelling?: boolean
  cancelError?: string
  expectedMs?: number
}
const tasks = new Map<string, BrowserTask>()
const listeners = new Set<() => void>()
const durations = new Map<string, number>()
const empty: BrowserTask[] = []
let snapshot = empty
function emit() {
  snapshot = [...tasks.values()]
  for (const listener of listeners) listener()
}
export const subscribeTasks = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const getTasks = () => snapshot
export const getServerTasks = () => empty

export async function cancelBrowserTask(id: string) {
  const task = tasks.get(id)
  if (!task || task.cancelling) return
  tasks.set(id, { ...task, cancelling: true, cancelError: undefined })
  emit()
  try {
    const response = await fetch(`/api/tasks?ids=${id}`, {
      method: "DELETE",
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error()
    task.controller.abort()
  } catch {
    const current = tasks.get(id)
    if (current)
      tasks.set(id, {
        ...current,
        cancelling: false,
        cancelError: "Could not cancel. Try again.",
      })
  } finally {
    emit()
  }
}
export async function clearBrowserTasks() {
  const pending: Promise<unknown>[] = []
  for (const task of tasks.values()) {
    pending.push(
      fetch(`/api/tasks?ids=${task.id}`, {
        method: "DELETE",
        keepalive: true,
        signal: AbortSignal.timeout(5000),
      }).catch(() => {})
    )
    task.controller.abort()
  }
  tasks.clear()
  emit()
  await Promise.allSettled(pending)
}
export async function refreshTaskProgress(signal: AbortSignal) {
  const ids = [...tasks.keys()].slice(0, 8)
  if (!ids.length) return
  await requestWithCooldown("read", async () => {
    const response = await fetch(`/api/tasks?ids=${ids.join(",")}`, {
      signal,
      cache: "no-store",
    })
    if (response.status === 429)
      throw noteCooldown(
        "read",
        Number(response.headers.get("Retry-After")) || 60
      )
    if (!response.ok) return
    const progress: Record<string, TaskProgress> = await response.json()
    for (const [id, status] of Object.entries(progress)) {
      const task = tasks.get(id)
      if (task) tasks.set(id, { ...task, progress: status })
    }
    emit()
  })
}

export async function trackDatabaseRequest<Output>(
  label: string,
  signal: AbortSignal | undefined,
  operation: (id: string, signal: AbortSignal) => Promise<Output>,
  kind: "read" | "metadata" | "csv" = "read"
): Promise<Output> {
  return requestWithCooldown(kind, async () => {
    signal?.throwIfAborted()
    const id = crypto.randomUUID()
    const controller = new AbortController()
    const started = Date.now()
    const abort = () => {
      void fetch(`/api/tasks?ids=${id}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {})
      controller.abort()
    }
    signal?.addEventListener("abort", abort, { once: true })
    tasks.set(id, {
      id,
      label,
      started,
      controller,
      expectedMs: durations.get(label),
    })
    emit()
    try {
      const result = await operation(id, controller.signal)
      durations.set(label, Math.max(1, Date.now() - started))
      return result
    } catch (error) {
      if (controller.signal.aborted || tasks.get(id)?.cancelling)
        throw new RequestCancelledError()
      throw error
    } finally {
      signal?.removeEventListener("abort", abort)
      tasks.delete(id)
      emit()
    }
  })
}
