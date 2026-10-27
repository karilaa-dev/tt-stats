import { T, useTranslation } from "@/lib/i18n/provider"
import { Field, FieldLabel } from "@/components/controls"
import { ToggleGroup, ToggleGroupItem } from "@/components/controls"
import type { ChatScope, StatsRange } from "@/lib/stats/types"
import { cn } from "@/lib/utils"

const scopeOptions: Array<{ value: ChatScope; label: string }> = [
  { value: "users", label: "Private users" },
  { value: "groups", label: "Groups" },
  { value: "all", label: "All chats" },
]
const rangeOptions: Array<{ value: StatsRange; label: string }> = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "31d", label: "31 days" },
  { value: "all", label: "All time" },
]

export function StatsFilters({
  scope,
  range,
  showScope = true,
  className,
  onScopeChange,
  onRangeChange,
}: {
  scope?: ChatScope
  range: StatsRange
  showScope?: boolean
  className?: string
  onScopeChange?: (scope: ChatScope) => void
  onRangeChange: (range: StatsRange) => void
}) {
  const { t } = useTranslation()

  return (
    <div className={cn("stats-filters", className)}>
      {showScope && scope ? (
        <Field className="stats-filter">
          <FieldLabel>
            <T>{"Audience"}</T>
          </FieldLabel>
          <ToggleGroup
            value={[scope]}
            onValueChange={(values) =>
              onScopeChange?.((values[0] as ChatScope | undefined) ?? scope)
            }
            aria-label={t("Chat scope")}
          >
            {scopeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                <T>{option.label}</T>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      ) : null}
      <Field className="stats-filter">
        <FieldLabel>
          <T>{"Period"}</T>
        </FieldLabel>
        <ToggleGroup
          value={[range]}
          onValueChange={(values) =>
            onRangeChange((values[0] as StatsRange | undefined) ?? range)
          }
          aria-label={t("Statistics period")}
        >
          {rangeOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              <T>{option.label}</T>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </div>
  )
}
