import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ShieldAlertIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

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
import { startBotstat } from "@/lib/botstat/functions"

export function BotstatCard() {
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: () => startBotstat(),
    onSuccess: (result) => {
      if (result.status === "success") {
        toast.success(result.message, {
          description: `Task ID: ${result.taskId}`,
        })
      } else {
        toast.error(result.message)
      }
    },
  })
  const pending = mutation.isPending

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
              <AlertDialogAction
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  mutation.mutate()
                }}
              >
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <UploadIcon data-icon="inline-start" />
                )}
                {pending ? "Starting…" : "Confirm upload"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
