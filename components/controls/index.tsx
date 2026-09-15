import { T, useTranslation } from "@/lib/i18n/provider"
import * as React from "react"
import { Button as BaseButton } from "@base-ui/react/button"
import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog"
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import { Switch as BaseSwitch } from "@base-ui/react/switch"
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group"
import { Toggle as BaseToggle } from "@base-ui/react/toggle"
import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { useRender } from "@base-ui/react/use-render"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Site-owned presentation over Base UI behavior. Styles live in controls.css.
type Variant =
  "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
type Size =
  "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn("control-button", `button-${variant}`, `button-${size}`, className)
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
      className={cn(buttonVariants({ variant, size }), className)}
    />
  )
}
function block<Tag extends keyof React.JSX.IntrinsicElements>(
  tag: Tag,
  slot: string
) {
  return function Block({
    className,
    ...props
  }: React.ComponentPropsWithRef<Tag>) {
    return React.createElement(tag, {
      ...props,
      "data-slot": slot,
      className: cn(`control-${slot}`, className),
    })
  }
}
export const CardHeader = block("div", "card-header")
export const CardTitle = block("h2", "card-title")
export const CardDescription = block("p", "card-description")
export const CardContent = block("div", "card-content")
export const CardFooter = block("div", "card-footer")
export const CardAction = block("div", "card-action")
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
      className={cn("control-card", className)}
    />
  )
}
export const TableHeader = block("thead", "table-header")
export const TableBody = block("tbody", "table-body")
export const TableFooter = block("tfoot", "table-footer")
export const TableRow = block("tr", "table-row")
export const TableHead = block("th", "table-head")
export const TableCell = block("td", "table-cell")
export const TableCaption = block("caption", "table-caption")
export function Table({
  className,
  ...props
}: React.ComponentPropsWithRef<"table">) {
  return (
    <div className="control-table-scroll">
      <table {...props} className={cn("control-table", className)} />
    </div>
  )
}
export function Badge({
  variant = "default",
  className,
  render,
  ...props
}: useRender.ComponentProps<"span"> & { variant?: Variant }) {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      ...props,
      "data-slot": "badge",
      className: cn("control-badge", `badge-${variant}`, className),
    },
  })
}
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
      className={cn("control-alert", `alert-${variant}`, className)}
    />
  )
}
export const AlertTitle = block("div", "alert-title")
export const AlertDescription = block("div", "alert-description")
export const AlertAction = block("div", "alert-action")
export const Empty = block("div", "empty")
export const EmptyHeader = block("div", "empty-header")
export const EmptyTitle = block("h3", "empty-title")
export const EmptyDescription = block("p", "empty-description")
export const EmptyContent = block("div", "empty-content")
export function EmptyMedia({
  variant = "default",
  ...props
}: React.ComponentPropsWithRef<"div"> & { variant?: "default" | "icon" }) {
  return <div {...props} data-slot="empty-media" data-variant={variant} />
}
export const Skeleton = block("div", "skeleton")
export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof LoaderCircleIcon>) {
  const { t } = useTranslation()

  return (
    <LoaderCircleIcon
      aria-label={t("Loading")}
      role="status"
      {...props}
      className={cn("control-spinner", className)}
    />
  )
}
export const Input = block("input", "input")
export const Label = block("label", "label")
export const FieldLabel = block("label", "field-label")
export const FieldTitle = block("div", "field-title")
export const FieldDescription = block("p", "field-description")
export const FieldContent = block("div", "field-content")
export const FieldGroup = block("div", "field-group")
export const FieldSet = block("fieldset", "field-set")
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
      className={cn("control-field", className)}
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
      className={cn("control-field-error", props.className)}
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
export function Switch({
  className,
  size = "default",
  ...props
}: BaseSwitch.Root.Props & { size?: "default" | "sm" }) {
  return (
    <BaseSwitch.Root
      {...props}
      data-slot="switch"
      data-size={size}
      className={cn("control-switch", className)}
    >
      <BaseSwitch.Thumb className="control-switch-thumb" />
    </BaseSwitch.Root>
  )
}

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogClose = BaseDialog.Close
export const DialogTitle = BaseDialog.Title
export const DialogDescription = BaseDialog.Description
export const DialogHeader = block("div", "dialog-header")
export function DialogFooter({
  showCloseButton,
  children,
  ...props
}: React.ComponentPropsWithRef<"div"> & { showCloseButton?: boolean }) {
  return (
    <div {...props} className={cn("control-dialog-footer", props.className)}>
      <T>{children}</T>
      <T>
        {showCloseButton && (
          <BaseDialog.Close render={<Button variant="outline" />}>
            <T>{"Close"}</T>
          </BaseDialog.Close>
        )}
      </T>
    </div>
  )
}
export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: BaseDialog.Popup.Props & { showCloseButton?: boolean }) {
  const { t } = useTranslation()

  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="control-backdrop" />
      <BaseDialog.Popup
        {...props}
        data-slot="dialog-content"
        className={cn("control-dialog", className)}
      >
        <T>{children}</T>
        <T>
          {showCloseButton && (
            <BaseDialog.Close
              aria-label={t("Close")}
              className="control-dialog-close"
              render={<Button size="icon-sm" variant="ghost" />}
            >
              <XIcon />
            </BaseDialog.Close>
          )}
        </T>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}
export const Sheet = BaseDialog.Root
export const SheetHeader = DialogHeader
export const SheetTitle = BaseDialog.Title
export const SheetDescription = BaseDialog.Description
export function SheetContent({
  side = "bottom",
  className,
  children,
  ...props
}: BaseDialog.Popup.Props & { side?: "bottom" | "left" | "right" | "top" }) {
  const { t } = useTranslation()

  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="control-backdrop" />
      <BaseDialog.Popup
        {...props}
        className={cn("control-sheet", `sheet-${side}`, className)}
      >
        <T>{children}</T>
        <BaseDialog.Close
          aria-label={t("Close navigation")}
          className="control-dialog-close"
          render={<Button size="icon" variant="ghost" />}
        >
          <XIcon />
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}
export const AlertDialog = BaseAlertDialog.Root
export const AlertDialogTrigger = BaseAlertDialog.Trigger
export const AlertDialogTitle = BaseAlertDialog.Title
export const AlertDialogDescription = BaseAlertDialog.Description
export const AlertDialogHeader = DialogHeader
export const AlertDialogFooter = block("div", "dialog-footer")
export const AlertDialogMedia = block("div", "dialog-media")
export const AlertDialogAction = Button
export function AlertDialogCancel(props: React.ComponentProps<typeof Button>) {
  return (
    <BaseAlertDialog.Close render={<Button variant="outline" />} {...props} />
  )
}
export function AlertDialogContent({
  size = "default",
  className,
  ...props
}: BaseAlertDialog.Popup.Props & { size?: "default" | "sm" }) {
  return (
    <BaseAlertDialog.Portal>
      <BaseAlertDialog.Backdrop className="control-backdrop" />
      <BaseAlertDialog.Popup
        {...props}
        data-size={size}
        className={cn("control-dialog", "control-confirmation", className)}
      />
    </BaseAlertDialog.Portal>
  )
}
export const TooltipProvider = BaseTooltip.Provider
export const Tooltip = BaseTooltip.Root
export const TooltipTrigger = BaseTooltip.Trigger
export function TooltipContent({
  side = "top",
  sideOffset = 8,
  className,
  ...props
}: BaseTooltip.Popup.Props & {
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        side={side}
        sideOffset={sideOffset}
        className="control-tooltip-positioner"
      >
        <BaseTooltip.Popup
          {...props}
          className={cn("control-tooltip", className)}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}
export function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  spacing = 2,
  ...props
}: BaseToggleGroup.Props & {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  spacing?: number
}) {
  return (
    <BaseToggleGroup
      {...props}
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      style={{ gap: spacing * 4 }}
      className={cn("control-toggle-group", className)}
    />
  )
}
export function ToggleGroupItem({ className, ...props }: BaseToggle.Props) {
  return (
    <BaseToggle
      {...props}
      data-slot="toggle-group-item"
      className={cn("control-toggle", className)}
    />
  )
}
export const Tabs = BaseTabs.Root
export function TabsList({
  className,
  variant = "default",
  ...props
}: BaseTabs.List.Props & { variant?: "default" | "line" }) {
  return (
    <BaseTabs.List
      {...props}
      data-variant={variant}
      className={cn("control-tabs-list", className)}
    />
  )
}
export function TabsTrigger({ className, ...props }: BaseTabs.Tab.Props) {
  return (
    <BaseTabs.Tab
      {...props}
      data-slot="tabs-trigger"
      className={cn("control-tab", className)}
    />
  )
}
export const TabsContent = BaseTabs.Panel
export function Pagination(props: React.ComponentPropsWithRef<"nav">) {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t("Pagination")}
      {...props}
      className={cn("control-pagination", props.className)}
    />
  )
}
export const PaginationContent = block("ul", "pagination-content")
export const PaginationItem = block("li", "pagination-item")
export function PaginationLink({
  isActive,
  size = "icon",
  className,
  ...props
}: React.ComponentPropsWithRef<"a"> & { isActive?: boolean; size?: Size }) {
  return (
    <a
      role="button"
      {...props}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
        className
      )}
    />
  )
}
export function PaginationPrevious(
  props: React.ComponentProps<typeof PaginationLink>
) {
  const { t } = useTranslation()

  return (
    <PaginationLink
      size="default"
      aria-label={t("Go to previous page")}
      {...props}
    >
      <ChevronLeftIcon />
      <T>{"Previous"}</T>
    </PaginationLink>
  )
}
export function PaginationNext(
  props: React.ComponentProps<typeof PaginationLink>
) {
  const { t } = useTranslation()

  return (
    <PaginationLink size="default" aria-label={t("Go to next page")} {...props}>
      <T>{"Next"}</T>
      <ChevronRightIcon />
    </PaginationLink>
  )
}
export function PaginationEllipsis() {
  return (
    <span aria-hidden="true">
      <EllipsisIcon />
    </span>
  )
}
