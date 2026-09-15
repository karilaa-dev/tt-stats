import { T, useTranslation } from "@/lib/i18n/provider"
import { AnimatedCounter } from "@/components/rare-ui/animated-counter"
export function ExactCounter({ value }: { value: string }) {
  const { locale } = useTranslation()
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(10000)
      .find((part) => part.type === "group")?.value ?? ""
  const amount = BigInt(value)
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) && amount >= 0n ? (
    <AnimatedCounter value={Number(amount)} separator={separator} />
  ) : (
    <span>
      <T>{amount.toLocaleString(locale)}</T>
    </span>
  )
}
