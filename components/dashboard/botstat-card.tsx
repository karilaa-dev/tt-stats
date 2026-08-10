"use client"

import { useActionState, useEffect, useState } from "react"
import { ShieldAlertIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { botstatAction, type BotstatActionState } from "@/app/botstat-action"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

const initialState: BotstatActionState = { status: "idle", nonce: 0 }

export function BotstatCard() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(botstatAction, initialState)

  useEffect(() => {
    if (state.status === "success")
      toast.success(state.message, { description: `Task ID: ${state.taskId}` })
    if (state.status === "error") toast.error(state.message)
  }, [state.nonce, state.message, state.status, state.taskId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Botstat.io verification</CardTitle>
        <CardDescription>
          Start a manual audience verification task.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>Privacy warning</AlertTitle>
          <AlertDescription>
            Every stored private-user and group ID will be sent to Botstat.io.
          </AlertDescription>
        </Alert>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button variant="outline" className="self-start" />}
          >
            <UploadIcon data-icon="inline-start" /> Start Botstat verification
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <ShieldAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Send all chat IDs?</AlertDialogTitle>
              <AlertDialogDescription>
                This uploads one ID per line to the configured Botstat.io
                account. The action cannot be recalled after submission.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <form action={action} onSubmit={() => setOpen(false)}>
                <AlertDialogAction
                  type="submit"
                  disabled={pending}
                  className="w-full"
                >
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <UploadIcon data-icon="inline-start" />
                  )}
                  {pending ? "Starting…" : "Confirm upload"}
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
