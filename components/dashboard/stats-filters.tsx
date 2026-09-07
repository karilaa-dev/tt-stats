import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ChatScope, StatsRange } from "@/lib/stats/types"
import { cn } from "@/lib/utils"

const scopeOptions: Array<{ value: ChatScope; label: string }> = [
  { value: "users", label: "Users" },
  { value: "groups", label: "Groups" },
  { value: "all", label: "All" },
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
  return (
    <div
      className={cn("mb-7 rounded-2xl border bg-card p-2 sm:p-3", className)}
    >
      <FieldGroup className="gap-3 lg:flex-row lg:items-center lg:justify-between">
        {showScope && scope ? (
          <Field orientation="responsive" className="gap-2 lg:w-auto">
            <FieldLabel className="px-2">Audience</FieldLabel>
            <ToggleGroup
              value={[scope]}
              onValueChange={(values) =>
                onScopeChange?.((values[0] as ChatScope | undefined) ?? scope)
              }
              variant="default"
              size="lg"
              spacing={1}
              aria-label="Chat scope"
              className="w-full sm:w-fit"
            >
              {scopeOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="min-h-11 flex-1 sm:min-w-20"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        ) : null}
        <Field orientation="responsive" className="gap-2 lg:w-auto">
          <FieldLabel className="px-2">Period</FieldLabel>
          <ToggleGroup
            value={[range]}
            onValueChange={(values) =>
              onRangeChange((values[0] as StatsRange | undefined) ?? range)
            }
            variant="default"
            size="lg"
            spacing={1}
            aria-label="Statistics period"
            className="w-full sm:w-fit"
          >
            {rangeOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="min-h-11 min-w-0 flex-1 sm:min-w-20"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </FieldGroup>
    </div>
  )
}
