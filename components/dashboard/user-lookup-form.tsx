import { T, useTranslation } from "@/lib/i18n/provider"
import { useEffect, useRef } from "react"
import { useForm, useSelector } from "@tanstack/react-form"
import {
  useDashboardContext,
  useDashboardNavigate,
  useHydrated,
} from "@/lib/dashboard-context"
import { ArrowUpRightIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/controls"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/controls"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/controls"
import { Input } from "@/components/controls"
import { Spinner } from "@/components/controls"
import { parseTelegramId } from "@/lib/stats/validation"
import { useAdminAccess } from "./admin-access"

export function UserLookupForm({
  initialId,
  searching,
}: {
  initialId: string
  searching: boolean
}) {
  const { t } = useTranslation()

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
        <CardTitle>
          <T>{"Find a chat"}</T>
        </CardTitle>
        <CardDescription>
          <T>{"Start with a Telegram ID."}</T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          role="search"
          aria-label={t("Chat lookup")}
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
                    <T>{"Telegram user or group ID"}</T>
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
                      placeholder={t("Enter a chat ID")}
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
                        <span className="sr-only">
                          <T>{"Clear lookup"}</T>
                        </span>
                      </Button>
                    ) : null}
                  </div>
                  {!field.state.meta.isValid ? (
                    <FieldError id={`${field.name}-error`}>
                      <T>
                        {String(field.state.meta.errors[0] ?? "Invalid ID")}
                      </T>
                    </FieldError>
                  ) : null}
                  <FieldDescription id={`${field.name}-hint`}>
                    <T>{"Group IDs include a minus sign."}</T>{" "}
                    <T>
                      {authenticated
                        ? "Results update as you type."
                        : "Searching requires the admin token."}
                    </T>
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
                    <T>
                      {searching ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <SearchIcon data-icon="inline-start" />
                      )}
                    </T>
                    <T>{searching ? "Finding chat…" : "Search"}</T>
                  </Button>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
      </CardContent>
      <T>
        {fakeMode ? (
          <CardFooter className="flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground">
              <T>{"Try a demo chat"}</T>
            </p>
            <div className="flex w-full flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!hydrated}
                onClick={() => form.setFieldValue("id", "123456789")}
              >
                <T>{"Private user "}</T>
                <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
              <Button
                variant="outline"
                disabled={!hydrated}
                onClick={() => form.setFieldValue("id", "-1001234567890")}
              >
                <T>{"Group "}</T>
                <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </T>
    </Card>
  )
}
