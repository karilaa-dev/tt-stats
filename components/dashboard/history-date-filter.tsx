import { T, useTranslation } from "@/lib/i18n/provider"
import { useId, useState } from "react"
import { Button } from "@/components/controls"
import { Input } from "@/components/controls"
import { useBrowserTime } from "@/lib/browser-time"
import { historyDateRange } from "@/lib/history-date-range"

export function HistoryDateFilter({
  fromDate,
  throughDate,
  onApply,
}: {
  fromDate: string
  throughDate: string
  onApply: (value: { fromDate: string; throughDate: string }) => void
}) {
  const { t } = useTranslation()

  const [from, setFrom] = useState(fromDate)
  const [through, setThrough] = useState(throughDate)
  const [error, setError] = useState("")
  const time = useBrowserTime()
  const hintId = useId()
  return (
    <form
      className="history-date-filter"
      aria-label={t("History date range")}
      onSubmit={(event) => {
        event.preventDefault()
        const result = historyDateRange(from, through)
        setError(result.error ?? "")
        if (!result.error) onApply({ fromDate: from, throughDate: through })
      }}
    >
      <div className="history-date-fields">
        <label>
          <span>
            <T>{"From date"}</T>
          </span>
          <Input
            type="date"
            min="2000-01-01"
            max="9998-12-31"
            value={from}
            aria-describedby={hintId}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          <span>
            <T>{"Through date"}</T>
          </span>
          <Input
            type="date"
            min="2000-01-01"
            max="9998-12-31"
            value={through}
            aria-describedby={hintId}
            onChange={(event) => setThrough(event.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="outline" size="sm">
          <T>{"Apply dates"}</T>
        </Button>
        <T>
          {from || through ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("")
                setThrough("")
                setError("")
                onApply({ fromDate: "", throughDate: "" })
              }}
            >
              <T>{"Clear dates"}</T>
            </Button>
          ) : null}
        </T>
      </div>
      <p id={hintId} className="history-date-hint">
        <T>{"Dates in "}</T>
        <T>{time.timeZone}</T>
        <T>{". Includes the full end date."}</T>
      </p>
      <T>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            <T>{error}</T>
          </p>
        ) : null}
      </T>
    </form>
  )
}
