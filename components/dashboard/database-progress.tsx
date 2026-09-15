import { formatDuration } from "@/lib/i18n/format"
import { T, useTranslation } from "@/lib/i18n/provider"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/controls"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/controls"
import {
  cancelBrowserTask,
  clearBrowserTasks,
  getServerTasks,
  getTasks,
  refreshTaskProgress,
  subscribeTasks,
} from "@/lib/tasks/client"

export function DatabaseProgress() {
  const { t, locale } = useTranslation()

  const tasks = useSyncExternalStore(subscribeTasks, getTasks, getServerTasks)
  const [now, setNow] = useState(0)
  const active = tasks.length > 0
  useEffect(() => {
    const leave = () => {
      void clearBrowserTasks()
    }
    window.addEventListener("pagehide", leave)
    return () => window.removeEventListener("pagehide", leave)
  }, [])
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        await refreshTaskProgress(controller.signal)
      } catch {
        /* Respect cooldown; no automatic request retries. */
      }
      if (!controller.signal.aborted) timeout = setTimeout(poll, 1500)
    }
    const clock = setInterval(() => setNow(Date.now()), 250)
    // Fast queries use the existing inline loading state without a flashing modal.
    timeout = setTimeout(poll, 650)
    return () => {
      clearInterval(clock)
      clearTimeout(timeout)
      controller.abort()
    }
  }, [active])
  const visible = tasks.filter((task) => now - task.started >= 650)
  return (
    <Dialog open={visible.length > 0} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            <T>{"Loading your data"}</T>
          </DialogTitle>
          <DialogDescription>
            <T>{"You can cancel a request at any time."}</T>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          {visible.map((task) => {
            const progress = task.progress
            const elapsed = Math.max(0, now - task.started)
            const measured =
              progress?.total != null &&
              progress.total > 0 &&
              progress.completed !== null
            const estimated =
              !measured && task.expectedMs && task.expectedMs > 1000
            const percent = measured
              ? Math.round((100 * progress.completed!) / progress.total!)
              : estimated
                ? Math.min(95, Math.round((100 * elapsed) / task.expectedMs!))
                : null
            const remaining = measured
              ? progress.remainingMs
              : estimated
                ? Math.max(0, task.expectedMs! - elapsed)
                : null
            return (
              <section
                key={task.id}
                aria-label={t(task.label)}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    <T>{task.label}</T>
                  </p>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    <T>
                      {percent === null
                        ? "Calculating…"
                        : `${estimated ? "About " : ""}${percent}%`}
                    </T>
                  </span>
                </div>
                <progress
                  aria-label={t(`${task.label} progress`)}
                  max={100}
                  value={percent ?? undefined}
                  className="database-progress-bar h-2 w-full"
                />
                <p role="status" className="text-sm text-muted-foreground">
                  <T>
                    {task.cancelling
                      ? "Cancelling…"
                      : (progress?.phase ?? "Waiting for the database")}
                  </T>
                  <T>
                    {measured &&
                      ` · ${progress.completed!.toLocaleString(locale)} / ${progress.total!.toLocaleString(locale)} videos`}
                  </T>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="text-muted-foreground tabular-nums">
                    <p>
                      <T>{"Elapsed: "}</T>
                      <T>{formatDuration(elapsed, locale)}</T>
                    </p>
                    <p>
                      <T>
                        {remaining === null
                          ? "Time left: estimating…"
                          : remaining <= 0
                            ? "Finishing…"
                            : `About ${formatDuration(remaining, locale)} left`}
                      </T>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={task.cancelling}
                    onClick={() => void cancelBrowserTask(task.id)}
                  >
                    <T>{"Cancel"}</T>
                  </Button>
                </div>
                <T>
                  {task.cancelError && (
                    <p role="alert" className="text-sm text-destructive">
                      <T>{task.cancelError}</T>
                    </p>
                  )}
                </T>
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
