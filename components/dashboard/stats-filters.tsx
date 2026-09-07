import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
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
    <Card className={cn("mb-6", className)}>
      <CardContent>
        <FieldGroup className="gap-4 lg:flex-row lg:items-end lg:gap-8">
          {showScope && scope ? (
            <Field className="lg:w-auto">
              <FieldLabel>Chat scope</FieldLabel>
              <ToggleGroup
                value={[scope]}
                onValueChange={(values) =>
                  onScopeChange?.((values[0] as ChatScope | undefined) ?? scope)
                }
                variant="outline"
                size="lg"
                spacing={0}
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
          <Field className="lg:w-auto">
            <FieldLabel>Period</FieldLabel>
            <ToggleGroup
              value={[range]}
              onValueChange={(values) =>
                onRangeChange((values[0] as StatsRange | undefined) ?? range)
              }
              variant="outline"
              size="lg"
              spacing={0}
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
      </CardContent>
    </Card>
  )
}
