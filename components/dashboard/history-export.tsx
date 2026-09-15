import { T } from "@/lib/i18n/provider"
import { useEffect, useRef, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "@/components/controls/toast"
import { buttonVariants } from "@/components/controls"
import { trackDatabaseRequest } from "@/lib/tasks/client"
import { noteCooldown } from "@/lib/http-client"

export function HistoryExport({
  href,
  userId,
}: {
  href: string
  userId: string
}) {
  const [loading, setLoading] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  return (
    <a
      href={href}
      className={buttonVariants({ variant: "outline" })}
      aria-disabled={loading}
      onClick={async (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return
        event.preventDefault()
        if (loading) return
        controller.current = new AbortController()
        setLoading(true)
        try {
          const blob = await trackDatabaseRequest(
            "Exporting download history",
            controller.current.signal,
            async (id, signal) => {
              const response = await fetch(href, {
                signal,
                headers: { "X-Database-Task": id },
              })
              if (response.status === 429)
                throw noteCooldown(
                  "csv",
                  Number(response.headers.get("Retry-After")) || 60
                )
              if (!response.ok)
                throw new Error(
                  "Could not export your history. Please try again."
                )
              return response.blob()
            },
            "csv"
          )
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `user_${userId}.csv`
          document.body.append(link)
          link.click()
          link.remove()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (error) {
          if (!controller.current?.signal.aborted)
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not export your history."
            )
        } finally {
          setLoading(false)
        }
      }}
    >
      <DownloadIcon data-icon="inline-start" />
      <T>{loading ? "Exporting…" : "Export full history"}</T>
    </a>
  )
}
