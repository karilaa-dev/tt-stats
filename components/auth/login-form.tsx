"use client"

import { useActionState } from "react"
import { LogInIcon } from "lucide-react"

import { loginAction, type LoginActionState } from "@/app/actions"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

const initialState: LoginActionState = {}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState)

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in to TT Stats</CardTitle>
        <CardDescription>
          Use the administrator credentials configured for this deployment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <input type="hidden" name="next" value={nextPath} />
            <Field data-invalid={Boolean(state.error)}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                required
                autoFocus
                aria-invalid={Boolean(state.error)}
              />
            </Field>
            <Field data-invalid={Boolean(state.error)}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(state.error)}
              />
              <FieldError>{state.error}</FieldError>
            </Field>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LogInIcon data-icon="inline-start" />
              )}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
