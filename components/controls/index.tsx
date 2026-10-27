import { T, useTranslation } from "@/lib/i18n/provider"
import * as React from "react"
import { Badge as KumoBadge } from "@cloudflare/kumo/components/badge"
import { buttonVariants as kumoButtonVariants } from "@cloudflare/kumo/components/button"
import { Dialog as KumoDialog } from "@cloudflare/kumo/components/dialog"
import { inputVariants } from "@cloudflare/kumo/components/input"
import { Loader } from "@cloudflare/kumo/components/loader"
import { Table as KumoTable } from "@cloudflare/kumo/components/table"
import { Button as BaseButton } from "@base-ui/react/button"
import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { Switch as BaseSwitch } from "@base-ui/react/switch"
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group"
import { Toggle as BaseToggle } from "@base-ui/react/toggle"
import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { XIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export { TooltipProvider } from "@cloudflare/kumo/components/tooltip"

// Site controls are Kumo components, or Base UI behaviour dressed in Kumo's
// classes where Kumo has no equivalent. The @ttgrab palette arrives through
// the Kumo tokens defined in styles.css.
type Variant =
  "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
type Size =
  "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
// Emphasis variants start from Kumo's secondary shape so the overrides below
// replace, rather than stack on, Kumo's gradient fill.
const kumoVariant = {
  default: "secondary",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "secondary",
  link: "ghost",
} as const
const kumoSize = {
  default: "base",
  xs: "xs",
  sm: "sm",
  lg: "lg",
  icon: "base",
  "icon-xs": "xs",
  "icon-sm": "sm",
  "icon-lg": "lg",
} as const
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    kumoButtonVariants({
      variant: kumoVariant[variant],
      size: kumoSize[size],
      shape: size.startsWith("icon") ? "square" : "base",
    }),
    "control-button shrink-0 font-medium whitespace-nowrap select-none [&_svg]:size-4 [&_svg]:shrink-0",
    // The site keeps flat cyan and red fills with dark text for contrast.
    variant === "default" &&
      "bg-kumo-brand !text-kumo-inverse ring-kumo-brand not-disabled:hover:bg-kumo-brand-hover disabled:bg-kumo-brand disabled:!text-kumo-inverse",
    variant === "destructive" &&
      "bg-kumo-danger !text-kumo-inverse ring-kumo-danger not-disabled:hover:bg-kumo-danger/85 disabled:bg-kumo-danger disabled:!text-kumo-inverse",
    variant === "link" && "text-kumo-link underline-offset-4 hover:underline",
    size === "xs" && "h-7 px-2",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50",
    className
  )
}
export function Button({
  variant,
  size,
  className,
  ...props
}: BaseButton.Props & { variant?: Variant; size?: Size }) {
  return (
    <BaseButton
      {...props}
      data-slot="button"
      className={buttonVariants({
        variant,
        size,
        className: typeof className === "string" ? className : undefined,
      })}
    />
  )
}
function block<Tag extends keyof React.JSX.IntrinsicElements>(
  tag: Tag,
  slot: string,
  classes = ""
) {
  return function Block({
    className,
    ...props
  }: React.ComponentPropsWithRef<Tag>) {
    return React.createElement(tag, {
      ...props,
      "data-slot": slot,
      className: cn(`control-${slot}`, classes, className),
    })
  }
}

// Cards follow Kumo's LayerCard surface: a raised base with a line ring.
export const CardHeader = block(
  "div",
  "card-header",
  "grid gap-1 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]"
)
export const CardTitle = block(
  "h2",
  "card-title",
  "text-lg leading-snug font-semibold text-kumo-strong"
)
export const CardDescription = block(
  "p",
  "card-description",
  "text-sm leading-normal text-kumo-subtle"
)
export const CardContent = block("div", "card-content", "px-5")
export const CardFooter = block(
  "div",
  "card-footer",
  "flex items-center gap-2 px-5"
)
export const CardAction = block(
  "div",
  "card-action",
  "col-start-2 row-span-2 row-start-1 self-start"
)
export function Card({
  size = "default",
  className,
  ...props
}: React.ComponentPropsWithRef<"section"> & { size?: "default" | "sm" }) {
  return (
    <section
      {...props}
      data-slot="card"
      data-size={size}
      className={cn(
        "control-card flex min-w-0 flex-col gap-4 rounded-lg bg-kumo-base py-4 text-kumo-default shadow-xs ring ring-kumo-line",
        className
      )}
    />
  )
}

export function Table({
  className,
  ...props
}: React.ComponentPropsWithRef<"table">) {
  return (
    <div className="control-table-scroll w-full overflow-auto">
      <KumoTable {...props} className={cn("control-table", className)} />
    </div>
  )
}
export function TableHeader(
  props: React.ComponentProps<typeof KumoTable.Header>
) {
  return (
    <KumoTable.Header
      {...props}
      className={cn(
        "control-table-header [&_th]:bg-transparent [&_th]:text-sm [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-kumo-subtle",
        props.className
      )}
    />
  )
}
export function TableBody(props: React.ComponentProps<typeof KumoTable.Body>) {
  return (
    <KumoTable.Body
      {...props}
      className={cn("control-table-body", props.className)}
    />
  )
}
export function TableRow(props: React.ComponentProps<typeof KumoTable.Row>) {
  return (
    <KumoTable.Row
      {...props}
      className={cn(
        "control-table-row border-b border-kumo-hairline last:border-b-0 even:bg-transparent",
        props.className
      )}
    />
  )
}
export function TableHead(props: React.ComponentProps<typeof KumoTable.Head>) {
  return (
    <KumoTable.Head
      {...props}
      className={cn("control-table-head", props.className)}
    />
  )
}
export function TableCell(props: React.ComponentProps<typeof KumoTable.Cell>) {
  return (
    <KumoTable.Cell
      {...props}
      className={cn("control-table-cell", props.className)}
    />
  )
}

const badgeVariant = {
  default: "teal-subtle",
  outline: "outline",
  secondary: "secondary",
  ghost: "secondary",
  destructive: "error",
  link: "outline",
} as const
export function Badge({
  variant = "default",
  className,
  render,
  children,
  ...props
}: React.ComponentPropsWithRef<"span"> & {
  variant?: Variant
  /** Optional element, such as a link, that wraps the badge. */
  render?: React.ReactElement<{ className?: string }>
}) {
  const badge = (
    <KumoBadge
      {...props}
      appearance="filled"
      variant={badgeVariant[variant]}
      className={cn(
        "control-badge gap-1 font-normal [&_svg]:size-3.5",
        variant === "default" && "bg-[var(--secondary)]",
        variant === "outline" && "border-kumo-line bg-transparent",
        className
      )}
    >
      {children}
    </KumoBadge>
  )
  return render
    ? React.cloneElement(
        render,
        { className: "inline-flex rounded-full hover:opacity-85" },
        badge
      )
    : badge
}

// Alerts use Kumo Banner styling while keeping the icon/title/description
// composition the pages already use.
export function Alert({
  variant = "default",
  className,
  ...props
}: React.ComponentPropsWithRef<"div"> & {
  variant?: "default" | "destructive"
}) {
  return (
    <div
      role="alert"
      {...props}
      data-slot="alert"
      className={cn(
        "control-alert grid grid-cols-1 items-start gap-x-3 gap-y-0.5 rounded-lg px-4 py-3 text-base has-[>svg]:grid-cols-[auto_1fr] [&>svg]:row-span-2 [&>svg]:h-lh [&>svg]:w-4 [&>svg]:shrink-0 [&>svg~*]:col-start-2",
        variant === "destructive"
          ? "alert-destructive bg-kumo-danger-tint text-kumo-danger"
          : "bg-kumo-info-tint ring ring-kumo-brand/15 [&>svg]:text-kumo-brand",
        className
      )}
    />
  )
}
export const AlertTitle = block(
  "div",
  "alert-title",
  "font-medium text-kumo-default"
)
export const AlertDescription = block(
  "div",
  "alert-description",
  "leading-normal text-kumo-subtle"
)

// Empty states mirror Kumo Empty.
export const Empty = block(
  "div",
  "empty",
  "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-kumo-line px-6 py-10 text-center"
)
export const EmptyHeader = block(
  "div",
  "empty-header",
  "grid justify-items-center gap-1.5"
)
export const EmptyTitle = block(
  "h3",
  "empty-title",
  "text-lg font-semibold text-kumo-default"
)
export const EmptyDescription = block(
  "p",
  "empty-description",
  "max-w-md text-base text-kumo-subtle"
)
export const EmptyContent = block(
  "div",
  "empty-content",
  "flex flex-wrap justify-center gap-2"
)
export function EmptyMedia({
  variant = "default",
  className,
  ...props
}: React.ComponentPropsWithRef<"div"> & { variant?: "default" | "icon" }) {
  return (
    <div
      {...props}
      data-slot="empty-media"
      data-variant={variant}
      className={cn(
        "mb-1 text-kumo-inactive [&_svg]:size-8",
        variant === "icon" &&
          "grid size-10 place-items-center rounded-lg bg-kumo-tint text-kumo-subtle [&_svg]:size-5",
        className
      )}
    />
  )
}
export const Skeleton = block(
  "div",
  "skeleton",
  "skeleton min-h-4 rounded-md bg-kumo-tint"
)
export function Spinner({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string
  "aria-label"?: string
  "data-icon"?: string
}) {
  const { t } = useTranslation()

  return (
    <Loader
      size={14}
      aria-label={ariaLabel ?? t("Loading")}
      className={cn("control-spinner shrink-0", className)}
    />
  )
}
export const Input = block(
  "input",
  "input",
  cn(
    inputVariants({ focusIndicator: true }),
    "w-full min-w-0 [color-scheme:dark] disabled:opacity-60 aria-invalid:!ring-kumo-danger"
  )
)
export const FieldLabel = block(
  "label",
  "field-label",
  "text-base font-medium text-kumo-default"
)
export const FieldDescription = block(
  "p",
  "field-description",
  "text-sm leading-normal text-kumo-subtle"
)
export const FieldContent = block("div", "field-content", "grid gap-1")
export const FieldGroup = block("div", "field-group", "flex flex-col gap-5")
export function Field({
  orientation = "vertical",
  className,
  ...props
}: React.ComponentPropsWithRef<"div"> & {
  orientation?: "vertical" | "horizontal" | "responsive"
}) {
  return (
    <div
      {...props}
      data-slot="field"
      data-orientation={orientation}
      className={cn(
        "control-field flex flex-col gap-2",
        orientation === "horizontal" &&
          "flex-row items-center justify-between gap-4",
        className
      )}
    />
  )
}
export function FieldError({
  children,
  errors,
  ...props
}: React.ComponentPropsWithRef<"div"> & {
  errors?: ({ message?: string } | undefined)[]
}) {
  return (
    <div
      role="alert"
      {...props}
      className={cn(
        "control-field-error text-sm text-kumo-danger",
        props.className
      )}
    >
      <T>
        {children ??
          [
            ...new Set(errors?.map((error) => error?.message).filter(Boolean)),
          ].join(". ")}
      </T>
    </div>
  )
}
// Kumo's Switch always sets its own aria-label, which would hide the
// <label htmlFor> the forms use, so Base UI keeps the behaviour here.
export function Switch({
  className,
  size = "default",
  ...props
}: BaseSwitch.Root.Props & { size?: "default" | "sm" }) {
  return (
    <BaseSwitch.Root
      {...props}
      data-slot="switch"
      className={cn(
        "control-switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-kumo-tint p-0 ring ring-kumo-line transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-kumo-brand data-checked:bg-kumo-brand data-checked:ring-kumo-brand data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
        size === "sm" ? "h-4 w-8" : "h-4.5 w-9",
        className
      )}
    >
      <BaseSwitch.Thumb
        className={cn(
          "bg-kumo-subtle data-checked:bg-kumo-inverse absolute top-0 bottom-0 left-0 rounded-full shadow-[0_1px_2px_var(--color-kumo-shadow-drop)] transition-all duration-150 ease-out motion-reduce:transition-none",
          size === "sm"
            ? "w-4 data-checked:left-4"
            : "w-4.5 data-checked:left-4.5"
        )}
      />
    </BaseSwitch.Root>
  )
}

export const Dialog = KumoDialog.Root
export const DialogTitle = KumoDialog.Title
export const DialogDescription = KumoDialog.Description
export const DialogHeader = block(
  "div",
  "dialog-header",
  "grid gap-1.5 pr-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-kumo-strong [&_p]:text-base [&_p]:leading-normal [&_p]:text-kumo-subtle"
)
export function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "lg",
}: {
  className?: string
  children?: React.ReactNode
  showCloseButton?: boolean
  size?: "sm" | "base" | "lg" | "xl"
}) {
  const { t } = useTranslation()

  return (
    <KumoDialog
      size={size}
      className={cn(
        "control-dialog flex max-h-[calc(100dvh-4rem)] flex-col gap-5 overflow-y-auto px-6 py-5",
        className
      )}
    >
      <T>{children}</T>
      {showCloseButton && (
        <KumoDialog.Close
          aria-label={t("Close")}
          className={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
            className: "absolute top-4 right-4",
          })}
        >
          <XIcon />
        </KumoDialog.Close>
      )}
    </KumoDialog>
  )
}

// Kumo has no bottom sheet, so the mobile navigation keeps a Base UI dialog
// with Kumo surfaces.
export const Sheet = BaseDialog.Root
export const SheetHeader = DialogHeader
export const SheetTitle = BaseDialog.Title
export const SheetDescription = BaseDialog.Description
export function SheetContent({
  className,
  children,
  ...props
}: BaseDialog.Popup.Props) {
  const { t } = useTranslation()

  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-kumo-recessed opacity-80 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <BaseDialog.Popup
        {...props}
        className={cn(
          "control-sheet fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-auto rounded-t-xl bg-kumo-base px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-kumo-default shadow-lg ring ring-kumo-line transition-transform duration-200 ease-out outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full",
          className
        )}
      >
        <T>{children}</T>
        <BaseDialog.Close
          aria-label={t("Close navigation")}
          className={buttonVariants({
            variant: "ghost",
            size: "icon",
            className: "absolute top-3 right-3",
          })}
        >
          <XIcon />
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

// Confirmation dialogs are Kumo dialogs with the alertdialog role.
export function AlertDialog(
  props: Omit<React.ComponentProps<typeof KumoDialog.Root>, "role">
) {
  const Root = KumoDialog.Root as React.ComponentType<
    typeof props & { role: "alertdialog" }
  >
  return <Root {...props} role="alertdialog" />
}
export const AlertDialogTitle = KumoDialog.Title
export const AlertDialogDescription = KumoDialog.Description
export const AlertDialogHeader = block(
  "div",
  "dialog-header",
  "grid gap-1.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-kumo-strong [&_p]:text-base [&_p]:leading-normal [&_p]:text-kumo-subtle"
)
export const AlertDialogFooter = block(
  "div",
  "dialog-footer",
  "-mx-6 -mb-5 flex flex-wrap justify-end gap-2 border-t border-kumo-hairline bg-kumo-elevated px-6 py-4"
)
export const AlertDialogMedia = block(
  "div",
  "dialog-media",
  "mb-2 grid size-9 place-items-center rounded-lg bg-[var(--secondary)] text-kumo-brand [&_svg]:size-5"
)
export const AlertDialogAction = Button
export function AlertDialogCancel(props: React.ComponentProps<typeof Button>) {
  return (
    <KumoDialog.Close
      render={<Button variant="secondary" />}
      {...(props as object)}
    />
  )
}
export function AlertDialogContent({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <KumoDialog
      size="lg"
      className={cn(
        "control-dialog flex flex-col gap-5 overflow-hidden px-6 py-5",
        className
      )}
    >
      <T>{children}</T>
    </KumoDialog>
  )
}

// Segmented controls follow Kumo's segmented Tabs: a recessed track with a
// raised active segment.
const segmentTrack =
  "inline-flex w-fit flex-wrap items-center gap-0.5 rounded-lg bg-kumo-recessed p-0.5 ring ring-kumo-hairline"
const segmentItem =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-base whitespace-nowrap text-kumo-subtle outline-none hover:text-kumo-default focus-visible:ring-2 focus-visible:ring-kumo-brand disabled:opacity-50 [&_svg]:size-4"
export function ToggleGroup({ className, ...props }: BaseToggleGroup.Props) {
  return (
    <BaseToggleGroup
      {...props}
      data-slot="toggle-group"
      className={cn("control-toggle-group", segmentTrack, className)}
    />
  )
}
export function ToggleGroupItem({ className, ...props }: BaseToggle.Props) {
  return (
    <BaseToggle
      {...props}
      data-slot="toggle-group-item"
      className={cn(
        "control-toggle",
        segmentItem,
        "data-pressed:bg-kumo-base data-pressed:font-medium data-pressed:text-kumo-brand data-pressed:shadow-xs data-pressed:ring data-pressed:ring-kumo-line",
        className
      )}
    />
  )
}
export const Tabs = BaseTabs.Root
export function TabsList({ className, ...props }: BaseTabs.List.Props) {
  return (
    <BaseTabs.List
      {...props}
      className={cn("control-tabs-list", segmentTrack, className)}
    />
  )
}
export function TabsTrigger({ className, ...props }: BaseTabs.Tab.Props) {
  return (
    <BaseTabs.Tab
      {...props}
      data-slot="tabs-trigger"
      className={cn(
        "control-tab",
        segmentItem,
        "data-active:bg-kumo-base data-active:font-medium data-active:text-kumo-brand data-active:shadow-xs data-active:ring data-active:ring-kumo-line",
        className
      )}
    />
  )
}
export const TabsContent = BaseTabs.Panel
