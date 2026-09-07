import { useEffect, useRef } from "react"
import { useForm, useSelector } from "@tanstack/react-form"
import { useDashboardNavigate, useHydrated } from "@/lib/dashboard-context"
import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
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
  const navigate = useDashboardNavigate()
  const hydrated = useHydrated()
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
  const typedId = useSelector(form.store, (state) => state.values.id)

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
      <CardHeader>
        <CardTitle>Find a chat</CardTitle>
        <CardDescription>
          Look up a Telegram ID to inspect activity and export download history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          role="search"
          aria-label="Chat lookup"
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
                <Field
                  data-invalid={!field.state.meta.isValid}
                  data-disabled={!hydrated}
                >
                  <FieldLabel htmlFor={field.name}>
                    Telegram user or group ID
                  </FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      disabled={!hydrated}
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="123456789 or -1001234567890"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      pattern="-?[0-9]+"
                      className="h-11 sm:max-w-lg sm:flex-1"
                      aria-invalid={!field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.isValid
                          ? `${field.name}-hint`
                          : `${field.name}-hint ${field.name}-error`
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="h-11 min-w-28 flex-1 sm:flex-none"
                        disabled={
                          !hydrated ||
                          searching ||
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
                          className="size-11"
                          disabled={!hydrated}
                          onClick={() => {
                            field.handleChange("")
                            document.getElementById(field.name)?.focus()
                          }}
                        >
                          <XIcon />
                          <span className="sr-only">Clear lookup</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!field.state.meta.isValid ? (
                    <FieldError id={`${field.name}-error`}>
                      {String(field.state.meta.errors[0] ?? "Invalid ID")}
                    </FieldError>
                  ) : null}
                  <FieldDescription id={`${field.name}-hint`}>
                    Searches automatically as you type. Group IDs start with a
                    minus sign.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
