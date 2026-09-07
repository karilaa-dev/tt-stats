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
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}
