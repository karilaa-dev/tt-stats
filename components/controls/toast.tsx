import { useTranslation } from "@/lib/i18n/provider"
import { Toast } from "@base-ui/react/toast"
const manager = Toast.createToastManager()
export const toast = {
  success: (title: string) => manager.add({ title, type: "success" }),
  error: (title: string) =>
    manager.add({ title, type: "error", timeout: 8000 }),
  warning: (title: string) => manager.add({ title, type: "warning" }),
  info: (title: string) => manager.add({ title, type: "info" }),
}
function Messages() {
  const { t } = useTranslation()

  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport className="control-toast-viewport">
        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            toast={item}
            className="control-toast"
            data-type={item.type}
          >
            <Toast.Content>
              <Toast.Title>
                {typeof item.title === "string" ? t(item.title) : item.title}
              </Toast.Title>
              <Toast.Description>
                {typeof item.description === "string"
                  ? t(item.description)
                  : item.description}
              </Toast.Description>
            </Toast.Content>
            <Toast.Close aria-label={t("Dismiss notification")}>×</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
export function Toaster() {
  return (
    <Toast.Provider toastManager={manager}>
      <Messages />
    </Toast.Provider>
  )
}
