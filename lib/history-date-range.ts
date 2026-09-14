/** Run in the browser: Date's local calendar rules include DST transitions. */
export function historyDateRange(
  fromDate: string,
  throughDate: string
): {
  from?: number
  until?: number
  error?: string
} {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
    const [year, month, day] = value.split("-").map(Number)
    if (year! < 2000 || year! > 9998) return null
    // Set the calendar components together. Parsing YYYY-MM-DD directly uses
    // UTC, while adding 86,400 seconds fails for 23- or 25-hour local days.
    const date = new Date(year!, month! - 1, day!, 0, 0, 0, 0)
    return date.getFullYear() === year &&
      date.getMonth() === month! - 1 &&
      date.getDate() === day
      ? date
      : null
  }
  const start = fromDate ? parse(fromDate) : undefined
  const end = throughDate ? parse(throughDate) : undefined
  if (start === null || end === null) return { error: "Enter a valid date." }
  if (fromDate && throughDate && fromDate > throughDate)
    return { error: "The end date must be on or after the start date." }
  // Construct midnight afresh: some zones skip midnight and normalize it to
  // 01:00. Preserving that hour with setDate would include part of the next day.
  const until = end
    ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0)
    : undefined
  return {
    ...(start ? { from: start.getTime() / 1000 } : {}),
    ...(until ? { until: until.getTime() / 1000 } : {}),
  }
}
