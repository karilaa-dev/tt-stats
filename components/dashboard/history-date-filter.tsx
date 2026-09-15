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
  const [from, setFrom] = useState(fromDate)
  const [through, setThrough] = useState(throughDate)
  const [error, setError] = useState("")
  const time = useBrowserTime()
  const hintId = useId()
  return (
    <form
      className="history-date-filter"
      aria-label="History date range"
      onSubmit={(event) => {
        event.preventDefault()
        const result = historyDateRange(from, through)
        setError(result.error ?? "")
        if (!result.error) onApply({ fromDate: from, throughDate: through })
      }}
    >
      <div className="history-date-fields">
        <label>
          <span>From date</span>
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
          <span>Through date</span>
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
          Apply dates
        </Button>
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
            Clear dates
          </Button>
        ) : null}
      </div>
      <p id={hintId} className="history-date-hint">
        Dates in {time.timeZone}. Includes the full end date.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
