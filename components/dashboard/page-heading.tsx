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
    <div className={cn("page-heading mb-7 max-w-3xl", className)}>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
