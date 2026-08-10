import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/auth/login-form"
import { safeNextPath } from "@/lib/auth/navigation"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage(props: {
  searchParams: Promise<{ next?: string }>
}) {
  return (
    <Suspense fallback={<LoginScreen />}>
      <LoginPageContent {...props} />
    </Suspense>
  )
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNextPath((await searchParams).next)
  return <LoginScreen next={next} />
}

function LoginScreen({ next }: { next?: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="flex w-full flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight">tt-bot</p>
          <p className="text-sm text-muted-foreground">Analytics console</p>
        </div>
        <LoginForm nextPath={next} />
      </div>
    </main>
  )
}
