import { useEffect, useRef } from "react"
import { useForm, useSelector } from "@tanstack/react-form"
import {
  useDashboardContext,
  useDashboardNavigate,
  useHydrated,
} from "@/lib/dashboard-context"
import { ArrowUpRightIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { useAdminAccess } from "./admin-access"

export function UserLookupForm({
  initialId,
  searching,
}: {
  initialId: string
  searching: boolean
}) {
  const navigate = useDashboardNavigate()
  const { authenticated, requireAdmin } = useAdminAccess()
  const hydrated = useHydrated()
  const { fakeMode } = useDashboardContext()
  const navigatedId = useRef(initialId)
  const form = useForm({
    defaultValues: { id: initialId },
    onSubmit: async ({ value }) => {
      const id = value.id.trim()
      if (!parseTelegramId(id)) return
      if (!(await requireAdmin())) return
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
    if (!authenticated) return
    if (id === initialId) return

    const timeout = window.setTimeout(() => {
      navigatedId.current = id
      void navigate({
        search: { id, page: 1 },
        replace: true,
      })
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [authenticated, initialId, navigate, typedId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Find a chat</CardTitle>
        <CardDescription>Start with a Telegram ID.</CardDescription>
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
                  <div className="flex items-center gap-2">
                    <Input
                      disabled={!hydrated}
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Enter a chat ID"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      pattern="-?[0-9]+"
                      className="h-12 min-w-0 flex-1"
                      aria-invalid={!field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.isValid
                          ? `${field.name}-hint`
                          : `${field.name}-hint ${field.name}-error`
                      }
                    />
                    {field.state.value ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-12"
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
                  {!field.state.meta.isValid ? (
                    <FieldError id={`${field.name}-error`}>
                      {String(field.state.meta.errors[0] ?? "Invalid ID")}
                    </FieldError>
                  ) : null}
                  <FieldDescription id={`${field.name}-hint`}>
                    Group IDs include a minus sign.{" "}
                    {authenticated
                      ? "Results update as you type."
                      : "Searching requires the admin token."}
                  </FieldDescription>
                  <Button
                    type="submit"
                    className="mt-1 h-11 w-full"
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
                    {searching ? "Finding chat…" : "Search"}
                  </Button>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
      </CardContent>
      {fakeMode ? (
        <CardFooter className="flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">Try a demo chat</p>
          <div className="flex w-full flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!hydrated}
              onClick={() => form.setFieldValue("id", "123456789")}
            >
              Private user <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              disabled={!hydrated}
              onClick={() => form.setFieldValue("id", "-1001234567890")}
            >
              Group <ArrowUpRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}
