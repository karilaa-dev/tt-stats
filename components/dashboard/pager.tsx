import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/controls"
import { T, useTranslation } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

/**
 * Shared previous/next pagination. Pass totalPages when it is known, or
 * hasMore for open-ended lists. Nothing renders for a single page.
 */
export function Pager({
  page,
  totalPages,
  hasMore,
  disabled = false,
  summary,
  label = "Pagination",
  className,
  onPageChange,
}: {
  page: number
  totalPages?: number
  hasMore?: boolean
  disabled?: boolean
  summary?: ReactNode
  label?: string
  className?: string
  onPageChange: (page: number) => void
}) {
  const { t, locale } = useTranslation()
  const canNext =
    totalPages === undefined ? Boolean(hasMore) : page < totalPages
  if (page <= 1 && !canNext && !summary) return null
  return (
    <nav aria-label={t(label)} className={cn("dashboard-pager", className)}>
      <p className="dashboard-pager-summary" aria-live="polite">
        <T>{summary ?? null}</T>
      </p>
      <div className="dashboard-pager-controls">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          aria-label={t("Go to previous page")}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          <span className="dashboard-pager-text">
            <T>{"Previous"}</T>
          </span>
        </Button>
        <span className="dashboard-pager-page" aria-current="page">
          <T>
            {totalPages === undefined
              ? `Page ${page.toLocaleString(locale)}`
              : `Page ${page.toLocaleString(locale)} of ${totalPages.toLocaleString(locale)}`}
          </T>
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !canNext}
          aria-label={t("Go to next page")}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="dashboard-pager-text">
            <T>{"Next"}</T>
          </span>
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  )
}
