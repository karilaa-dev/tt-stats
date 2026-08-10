"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
}: {
  scope?: ChatScope
  range: StatsRange
  showScope?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(search)
    params.set(name, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <FieldGroup className="mb-6 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
      {showScope && scope ? (
        <Field>
          <FieldLabel>Chat scope</FieldLabel>
          <ToggleGroup
            value={[scope]}
            onValueChange={(values) =>
              values[0] && setParam("scope", String(values[0]))
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
            values[0] && setParam("range", String(values[0]))
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
  )
}
