import { useEffect, useRef } from "react"
import { useForm, useStore } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { parseTelegramId } from "@/lib/stats/validation"

export function UserLookupForm({
  initialId,
  searching,
}: {
  initialId: string
  searching: boolean
}) {
  const navigate = useNavigate({ from: "/dashboard/users" })
  const navigatedId = useRef(initialId)
  const form = useForm({
    defaultValues: { id: initialId },
    onSubmit: async ({ value }) => {
      const id = value.id.trim()
      if (!parseTelegramId(id)) return
      navigatedId.current = id
      await navigate({
        search: { id, page: 1 },
      })
    },
  })
  const typedId = useStore(form.store, (state) => state.values.id)

  useEffect(() => {
    if (initialId === navigatedId.current) return
    navigatedId.current = initialId
    form.setFieldValue("id", initialId)
  }, [form, initialId])

  useEffect(() => {
    const id = typedId.trim()
    if (id === initialId) return

    const timeout = window.setTimeout(() => {
      navigatedId.current = id
      void navigate({
        search: { id, page: 1 },
        replace: true,
      })
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [initialId, navigate, typedId])

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
                onChange: ({ value }) =>
                  !value.trim() || parseTelegramId(value.trim())
                    ? undefined
                    : "Use a signed integer without spaces or decimals.",
                onSubmit: ({ value }) =>
                  value.trim() && parseTelegramId(value.trim())
                    ? undefined
                    : "Enter a signed integer without decimals.",
              }}
            >
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor={field.name}>
                    Telegram user or group ID
                  </FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="123456789 or -1001234567890"
                      inputMode="numeric"
                      pattern="-?[0-9]+"
                      className="sm:max-w-md sm:flex-1"
                      aria-invalid={!field.state.meta.isValid}
                      aria-describedby={`${field.name}-hint`}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={
                          !field.state.value.trim() ||
                          !parseTelegramId(field.state.value.trim())
                        }
                      >
                        {searching ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <SearchIcon data-icon="inline-start" />
                        )}
                        {searching ? "Searching…" : "Search"}
                      </Button>
                      {field.state.value ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.handleChange("")}
                        >
                          <XIcon />
                          <span className="sr-only">Clear lookup</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!field.state.meta.isValid ? (
                    <FieldError>
                      {String(field.state.meta.errors[0] ?? "Invalid ID")}
                    </FieldError>
                  ) : null}
                  <p
                    id={`${field.name}-hint`}
                    className="text-xs text-muted-foreground"
                  >
                    Results update automatically after you stop typing.
                  </p>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
