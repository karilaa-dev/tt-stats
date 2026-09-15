import { AnimatedCounter } from "@/components/rare-ui/animated-counter"
export function ExactCounter({ value }: { value: string }) {
  const amount = BigInt(value)
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) && amount >= 0n ? (
    <AnimatedCounter value={Number(amount)} />
  ) : (
    <span>{amount.toLocaleString("en-US")}</span>
  )
}
