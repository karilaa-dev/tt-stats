import { T, useTranslation } from "@/lib/i18n/provider"
import {
  InstagramLogoIcon,
  StackIcon,
  TiktokLogoIcon,
} from "@phosphor-icons/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/controls"
import type { DownloadPlatform } from "@/lib/stats/types"
import { cn } from "@/lib/utils"

export type VideoPlatform = Exclude<DownloadPlatform, "all">

export const platformOptions = [
  { value: "all", label: "All platforms", icon: StackIcon },
  { value: "tiktok", label: "TikTok", icon: TiktokLogoIcon },
  { value: "instagram", label: "Instagram", icon: InstagramLogoIcon },
] as const satisfies ReadonlyArray<{
  value: DownloadPlatform
  label: string
  icon: unknown
}>

/** All platforms, TikTok, or Instagram as one segmented control. */
export function PlatformToggle({
  value,
  onValueChange,
  className,
  ...labelling
}: {
  value: DownloadPlatform
  onValueChange: (platform: DownloadPlatform) => void
  className?: string
} & ({ "aria-label": string } | { "aria-labelledby": string })) {
  return (
    <ToggleGroup
      {...labelling}
      className={cn("platform-toggle", className)}
      value={[value]}
      onValueChange={(values) =>
        onValueChange((values[0] as DownloadPlatform | undefined) ?? value)
      }
    >
      {platformOptions.map((option) => {
        const Icon = option.icon
        return (
          <ToggleGroupItem key={option.value} value={option.value}>
            <Icon aria-hidden="true" />
            <T>{option.label}</T>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

/**
 * The platform a post came from. Compact marks show only the logo, keeping
 * the name for screen readers and as a tooltip.
 */
export function PlatformMark({
  platform,
  compact = false,
  className,
}: {
  platform: VideoPlatform
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const option = platformOptions.find((item) => item.value === platform)!
  const Icon = option.icon
  return (
    <span
      className={cn("platform-mark", className)}
      data-platform={platform}
      title={compact ? t(option.label) : undefined}
    >
      <Icon aria-hidden="true" />
      <span className={compact ? "sr-only" : undefined}>
        <T>{option.label}</T>
      </span>
    </span>
  )
}
