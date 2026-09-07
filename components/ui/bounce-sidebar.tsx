"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react"
import { motion, useAnimate, useReducedMotion } from "motion/react"
import { arc } from "motion"
import { cn } from "@/lib/utils"

// Adapted from Rare UI: native Astro links, icons, and reduced motion.
const MotionLink = motion.a

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

export type BounceSidebarItem =
  | string
  | {
      label: string
      href?: string
      icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    }
  | { label: string; heading: true }

export type BounceSidebarProps = Omit<ComponentProps<"ul">, "onChange"> & {
  items: BounceSidebarItem[]
  value?: number
  defaultValue?: number
  onChange?: (index: number) => void
  dotColor?: string
}

export function BounceSidebar({
  items,
  value,
  defaultValue = 0,
  onChange,
  dotColor = "var(--primary)",
  className,
  ...props
}: BounceSidebarProps) {
  const reducedMotion = useReducedMotion()
  const [internalValue, setInternalValue] = useState(defaultValue)
  const activeIndex = value ?? internalValue
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const markerIndex = hoverIndex ?? activeIndex

  const [dot, animate] = useAnimate<HTMLSpanElement>()
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const prevY = useRef<number | null>(null)

  const [dotSize, setDotSize] = useState(6)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    setDotSize(Math.round(6 * dpr) / dpr)
  }, [])

  useIsomorphicLayoutEffect(() => {
    let cancelled = false
    const snap = () => {
      const el = itemRefs.current[markerIndex]
      if (cancelled || !el || !dot.current) return
      const dpr = window.devicePixelRatio || 1
      const size = Math.round(6 * dpr) / dpr
      const toY =
        Math.round((el.offsetTop + el.offsetHeight / 2 - size / 2) * dpr) / dpr
      animate(dot.current, { x: 0, y: toY }, { duration: 0 })
      prevY.current = toY
      setReady(true)
    }

    snap()
    const raf = requestAnimationFrame(snap)
    document.fonts?.ready.then(snap)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const el = itemRefs.current[markerIndex]
    if (!el || !dot.current) return

    const dpr = window.devicePixelRatio || 1
    const toY =
      Math.round((el.offsetTop + el.offsetHeight / 2 - dotSize / 2) * dpr) / dpr

    if (prevY.current === null) {
      animate(dot.current, { x: 0, y: toY }, { duration: 0 })
      prevY.current = toY
      return
    }

    const fromY = prevY.current
    const delta = toY - fromY
    prevY.current = toY
    if (delta === 0) return

    const distance = Math.abs(delta)
    const path = arc({
      strength: Math.min(0.8, 14 / distance),
      direction: delta > 0 ? "ccw" : "cw",
    })

    animate(
      dot.current,
      { x: 0, y: toY },
      { duration: reducedMotion ? 0 : 0.25, ease: "easeOut", path }
    )
  }, [markerIndex, animate, dot, dotSize, reducedMotion])

  const select = (index: number) => {
    if (value === undefined) setInternalValue(index)
    onChange?.(index)
  }

  return (
    <ul
      data-slot="bounce-sidebar"
      className={cn("relative flex flex-col gap-1 pl-6", className)}
      {...props}
      onPointerLeave={() => setHoverIndex(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setHoverIndex(null)
      }}
    >
      <li
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 list-none"
      >
        <span
          ref={dot}
          aria-hidden
          className="absolute top-0 left-2 rounded-full transition-opacity duration-150"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: dotColor,
            opacity: ready ? 1 : 0,
          }}
        />
      </li>

      {items.map((item, index) => {
        const label = typeof item === "string" ? item : item.label

        if (typeof item !== "string" && "heading" in item) {
          return (
            <li
              key={`${index}-${label}`}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              role="presentation"
              data-slot="bounce-sidebar-heading"
              style={{ color: dotColor }}
              className={cn(
                "px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] uppercase",
                index === 0 ? "pt-0" : "pt-7"
              )}
            >
              {label}
            </li>
          )
        }

        const Icon = typeof item !== "string" ? item.icon : undefined
        const href = typeof item === "string" ? undefined : item.href
        const isActive = index === activeIndex
        const itemClassName = cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors duration-200",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )

        return (
          <li
            key={`${index}-${label}`}
            onPointerEnter={() => setHoverIndex(index)}
            onFocus={() => setHoverIndex(index)}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
          >
            {href ? (
              <MotionLink
                href={href}
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
                onClick={() => select(index)}
                className={itemClassName}
              >
                {Icon ? <Icon aria-hidden={true} /> : null}
                {label}
              </MotionLink>
            ) : (
              <motion.button
                type="button"
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
                onClick={() => select(index)}
                className={itemClassName}
              >
                {Icon ? <Icon aria-hidden={true} /> : null}
                {label}
              </motion.button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
