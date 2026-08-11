import { getLanguagePresentation } from "@/lib/language"

export function LanguageValue({ value }: { value: string }) {
  const language = getLanguagePresentation(value)

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="text-xl leading-none" aria-hidden="true">
        {language.flag}
      </span>
      <span className="truncate font-sans font-medium">{language.name}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {language.code.toUpperCase()}
      </span>
    </div>
  )
}
