import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ChatScope, StatsRange } from "@/lib/stats/types"

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
  onScopeChange,
  onRangeChange,
}: {
  scope?: ChatScope
  range: StatsRange
  showScope?: boolean
  onScopeChange?: (scope: ChatScope) => void
  onRangeChange: (range: StatsRange) => void
}) {
  return (
    <Card className="mb-6">
      <CardContent>
        <FieldGroup className="sm:flex-row sm:items-end">
          {showScope && scope ? (
            <Field>
              <FieldLabel>Chat scope</FieldLabel>
              <ToggleGroup
                value={[scope]}
                onValueChange={(values) =>
                  values[0] && onScopeChange?.(values[0] as ChatScope)
                }
                variant="outline"
                spacing={0}
                aria-label="Chat scope"
              >
                {scopeOptions.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          ) : null}
          <Field>
            <FieldLabel>Period</FieldLabel>
            <ToggleGroup
              value={[range]}
              onValueChange={(values) =>
                values[0] && onRangeChange(values[0] as StatsRange)
              }
              variant="outline"
              spacing={0}
              aria-label="Statistics period"
              className="flex-wrap"
            >
              {rangeOptions.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
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
