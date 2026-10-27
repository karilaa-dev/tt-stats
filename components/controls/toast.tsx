import { useTranslation } from "@/lib/i18n/provider"
import {
  Toasty,
  createKumoToastManager,
} from "@cloudflare/kumo/components/toast"
import { useEffect, useState } from "react"

const manager = createKumoToastManager()
// Toasts are raised outside React, so the mounted Toaster lends its translator.
let translate = (text: string) => text
const add = (
  title: string,
  variant: "success" | "error" | "warning" | "info",
  timeout?: number
) => manager.add({ title: translate(title), variant, timeout })
export const toast = {
  success: (title: string) => add(title, "success"),
  error: (title: string) => add(title, "error", 8000),
  warning: (title: string) => add(title, "warning"),
  info: (title: string) => add(title, "info"),
}
export function Toaster() {
  const { t } = useTranslation()
  useEffect(() => {
    translate = t
  }, [t])
  // Kumo's viewport sits at z-index 1; this layer lifts it above the shell.
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  return (
    <div ref={setLayer} className="toast-layer">
      {layer && (
        <Toasty toastManager={manager} container={layer}>
          {null}
        </Toasty>
      )}
    </div>
  )
}
