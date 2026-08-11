import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseTelegramId } from "@/lib/stats/validation"

export function UserLookupForm({ initialId }: { initialId: string }) {
  const navigate = useNavigate({ from: "/dashboard/users" })
  const form = useForm({
    defaultValues: { id: initialId },
    onSubmit: async ({ value }) => {
      await navigate({
        search: { id: value.id.trim() },
      })
    },
  })

  return (
    <Card className="mb-6">
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="id"
              validators={{
                onSubmit: ({ value }) =>
                  value.trim() && parseTelegramId(value.trim())
                    ? undefined
                    : "Enter a signed integer without decimals.",
              }}
            >
              {(field) => (
                <Field
                  orientation="responsive"
                  data-invalid={!field.state.meta.isValid}
                >
                  <FieldLabel htmlFor={field.name}>
                    Telegram user or group ID
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="123456789 or -1001234567890"
                    inputMode="numeric"
                    pattern="-?[0-9]+"
                    className="sm:max-w-sm"
                    aria-invalid={!field.state.meta.isValid}
                  />
                  <Button type="submit">
                    <SearchIcon data-icon="inline-start" /> Search
                  </Button>
                  {!field.state.meta.isValid ? (
                    <FieldError>
                      {String(field.state.meta.errors[0] ?? "Invalid ID")}
                    </FieldError>
                  ) : null}
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
