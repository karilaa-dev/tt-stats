import { T } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

export function PageHeading({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={cn("page-heading", className)}>
      <h1>
        <T>{title}</T>
      </h1>
      <p>
        <T>{description}</T>
      </p>
    </div>
  )
}
