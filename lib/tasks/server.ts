import "@/lib/server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import type { AstroCookies } from "astro"
import { ADMIN_COOKIE } from "@/lib/admin/session"
import { USER_COOKIE } from "@/lib/auth/session"
import type { Principal } from "@/lib/auth/types"
import type { TaskProgress } from "./types"

export const validTaskId = (id: string) => /^[a-f0-9-]{36}$/u.test(id)
export function taskOwner(
  principal: Principal,
  cookies: AstroCookies,
  ip: string
) {
  // Bind tasks to the verified session as well as the account. Logout or a
  // different admin session must not grant access to a previous request.
  const identity = principal.admin
    ? `admin:${cookies.get(ADMIN_COOKIE)?.value}`
    : principal.user
      ? `user:${principal.user.id}:${cookies.get(USER_COOKIE)?.value}`
      : `anonymous:${ip}`
  return createHash("sha256").update(identity).digest("hex")
}

export class DatabaseTask {
  readonly id: string
  constructor(id?: string) {
    this.id = id && validTaskId(id) ? id : randomUUID()
  }
  readonly controller = new AbortController()
  readonly started = Date.now()
  private phaseStarted = this.started
  private phase = "Querying database"
  private completed: number | null = null
  private total: number | null = null
  private estimate: { remainingMs: number; at: number } | null = null
  finished = false

  report(
    phase: string,
    completed: number | null = null,
    total: number | null = null,
    remainingMs?: number
  ) {
    this.controller.signal.throwIfAborted()
    if (phase !== this.phase) this.phaseStarted = Date.now()
    this.phase = phase
    this.completed = completed
    this.total = total
    this.estimate =
      remainingMs === undefined ? null : { remainingMs, at: Date.now() }
  }
  status(): TaskProgress {
    const elapsed = Date.now() - this.phaseStarted
    const batchRemaining = this.estimate
      ? this.estimate.remainingMs - (Date.now() - this.estimate.at)
      : null
    const remaining = this.estimate
      ? batchRemaining! > 0
        ? batchRemaining
        : this.completed === this.total
          ? 0
          : null
      : this.completed && this.total && elapsed >= 250
        ? (elapsed / this.completed) * (this.total - this.completed)
        : null
    return {
      phase: this.phase,
      completed: this.completed,
      total: this.total,
      elapsedMs: Date.now() - this.started,
      remainingMs: remaining,
      state: this.controller.signal.aborted
        ? "cancelled"
        : this.finished
          ? "done"
          : "running",
    }
  }
}

const scope = new AsyncLocalStorage<DatabaseTask>()
export const currentDatabaseTask = () => scope.getStore()
export const withDatabaseTask = <T>(task: DatabaseTask, operation: () => T) =>
  scope.run(task, operation)
export const reportDatabaseProgress = (
  phase: string,
  completed?: number,
  total?: number,
  remainingMs?: number
) => scope.getStore()?.report(phase, completed, total, remainingMs)

export class TaskRegistry {
  private entries = new Map<
    string,
    { owner: string; task: DatabaseTask; expires: number }
  >()
  constructor(
    private capacity = 500,
    private now = Date.now
  ) {}
  private sweep() {
    for (const [id, entry] of this.entries) {
      if (entry.expires <= this.now()) {
        if (!entry.task.finished) entry.task.controller.abort()
        this.entries.delete(id)
      }
    }
  }
  start(id: string, owner: string) {
    this.sweep()
    const previous = this.entries.get(id)
    // A cancel can arrive before the original request reaches the server.
    if (previous?.owner === owner && previous.task.controller.signal.aborted)
      throw new DOMException("Request cancelled", "AbortError")
    if (
      previous ||
      this.entries.size >= this.capacity ||
      [...this.entries.values()].filter(
        (entry) => entry.owner === owner && !entry.task.finished
      ).length >= 8
    )
      return null
    const task = new DatabaseTask(id)
    this.entries.set(id, { owner, task, expires: this.now() + 120_000 })
    return task
  }
  get(id: string, owner: string) {
    this.sweep()
    const entry = this.entries.get(id)
    return entry?.owner === owner ? entry.task : undefined
  }
  finish(id: string) {
    const entry = this.entries.get(id)
    if (entry) {
      entry.task.finished = true
      entry.expires = this.now() + 10_000
    }
  }
  cancel(id: string, owner: string) {
    this.sweep()
    let entry = this.entries.get(id)
    if (entry && entry.owner !== owner) return false
    if (!entry) {
      if (
        this.entries.size >= this.capacity ||
        [...this.entries.values()].filter((value) => value.owner === owner)
          .length >= 8
      )
        return false
      const task = new DatabaseTask()
      task.finished = true
      entry = { owner, task, expires: this.now() + 10_000 }
      this.entries.set(id, entry)
    }
    entry.task.controller.abort()
    return true
  }
}
export const databaseTasks = new TaskRegistry()
