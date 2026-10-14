import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { T } from "@/lib/i18n/provider"

/** Headline figures shown above a page's detailed tables. */
export function SummaryStrip({
  items,
}: {
  items: {
    label: string
    value: ReactNode
    icon?: LucideIcon
    wide?: boolean
  }[]
}) {
  return (
    <dl className="summary-strip">
      {items.map(({ label, value, icon: Icon, wide }) => (
        <div key={label} data-wide={wide || undefined}>
          <dt>
            {Icon ? <Icon aria-hidden="true" /> : null}
            <T>{label}</T>
          </dt>
          <dd>
            <T>{value}</T>
          </dd>
        </div>
      ))}
    </dl>
  )
}
