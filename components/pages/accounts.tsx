import "./accounts.css"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { actions } from "astro:actions"
import {
  ArrowClockwiseIcon,
  BellRingingIcon,
  BellSlashIcon,
  InfoIcon,
  InstagramLogoIcon,
  MagnifyingGlassIcon,
  ShuffleIcon,
  TiktokLogoIcon,
  WarningCircleIcon,
  type Icon,
} from "@phosphor-icons/react"
import {
  Button,
  Input,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/controls"
import { PageHeading } from "@/components/dashboard/page-heading"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { useDashboardContext } from "@/lib/dashboard-context"
import {
  formatEpoch,
  formatTimestamp,
  useBrowserTime,
  type BrowserTimeSettings,
} from "@/lib/browser-time"
import { T, useTranslation } from "@/lib/i18n/provider"
import { databaseAction } from "@/lib/tasks/action"
import { cn } from "@/lib/utils"
import type {
  FallbackStats,
  InstagramAccount,
  ScraperRange,
  ScraperStatus,
  SourceResult,
  TikTokIdentity,
} from "@/lib/scraper/types"

type Status = InstagramAccount["status"]
type Tone = "danger" | "warning" | "ok" | "neutral"

const statusMeta: Record<Status, { label: string; tone: Tone; rank: number }> =
  {
    dead: { label: "Dead", tone: "danger", rank: 0 },
    cooldown: { label: "Cooling down", tone: "warning", rank: 1 },
    available: { label: "Available", tone: "ok", rank: 2 },
  }

const ranges: { value: ScraperRange; short: string; label: string }[] = [
  { value: "24h", short: "24h", label: "Last 24 hours" },
  { value: "7d", short: "7d", label: "Last 7 days" },
  { value: "30d", short: "30d", label: "Last 30 days" },
  { value: "all", short: "All", label: "All time" },
]

/* ------------------------------------------------------------------------ */
/* Formatting                                                                */
/* ------------------------------------------------------------------------ */

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

const relativeSteps: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
  ["year", Infinity],
]
function relativeTime(ms: number, now: number, locale: string) {
  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  })
  let value = (ms - now) / 1000
  if (Math.abs(value) < 45) return format.format(0, "second")
  for (const [unit, size] of relativeSteps) {
    if (Math.abs(value) < size) return format.format(Math.round(value), unit)
    value /= size
  }
  return format.format(Math.round(value), "year")
}

/** A recorded moment: relative time first, exact local time underneath. */
function When({
  value,
  now,
  time,
  locale,
}: {
  value: string | null
  now: number
  time: BrowserTimeSettings
  locale: string
}) {
  if (!value) return <Nothing />
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return <span>{value}</span>
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear()
  return (
    <time
      className="sa-when"
      dateTime={value}
      title={formatTimestamp(ms / 1000, time)}
    >
      <span>{relativeTime(ms, now, locale)}</span>
      <span className="sa-when-exact">
        {formatEpoch(ms / 1000, time, {
          month: "short",
          day: "numeric",
          ...(sameYear ? {} : { year: "numeric" }),
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </time>
  )
}

function Nothing() {
  const { t } = useTranslation()
  return (
    <span className="sa-nothing" aria-label={t("None recorded")}>
      —
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Small building blocks                                                     */
/* ------------------------------------------------------------------------ */

function StatusPill({ status }: { status: Status }) {
  const meta = statusMeta[status]
  return (
    <span className="sa-status" data-tone={meta.tone}>
      <span aria-hidden="true" className="sa-dot" />
      <T>{meta.label}</T>
    </span>
  )
}

function SourceError({ title, error }: { title: string; error: string }) {
  return (
    <div role="alert" className="sa-callout" data-tone="danger">
      <WarningCircleIcon aria-hidden="true" weight="fill" />
      <div>
        <p className="font-medium text-kumo-default">
          <T>{title}</T>
        </p>
        <p>
          <T>{error}</T>
        </p>
      </div>
    </div>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="sa-empty">{children}</p>
}

/** A labelled value. Labels are visible on narrow rows and become column
 * headers (visually) on wide rows, so every value keeps its label for
 * assistive technology either way. */
function Field({
  label,
  empty,
  numeric,
  children,
}: {
  label: string
  empty?: boolean
  numeric?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="sa-field"
      data-empty={empty || undefined}
      data-numeric={numeric || undefined}
    >
      <dt>
        <T>{label}</T>
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

function ColumnHeads({ labels }: { labels: string[] }) {
  return (
    <div className="sa-heads" aria-hidden="true">
      {labels.map((label) => (
        <span key={label}>
          <T>{label}</T>
        </span>
      ))}
    </div>
  )
}

type Filter = "all" | Status
function StatusFilter({
  label,
  value,
  onChange,
  counts,
  statuses,
}: {
  label: string
  value: Filter
  onChange: (value: Filter) => void
  counts: Record<Filter, number>
  statuses: Status[]
}) {
  const { t } = useTranslation()
  const options: Filter[] = ["all", ...statuses]
  return (
    <ToggleGroup
      aria-label={t(label)}
      className="sa-filter"
      value={[value]}
      onValueChange={(values) =>
        onChange((values[0] as Filter | undefined) ?? value)
      }
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          data-tone={option === "all" ? undefined : statusMeta[option].tone}
        >
          {option !== "all" && <span aria-hidden="true" className="sa-dot" />}
          <T>{option === "all" ? "All" : statusMeta[option].label}</T>
          <span className="sa-filter-count">{counts[option]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function countStatuses(items: { status: Status }[]) {
  const counts: Record<Filter, number> = {
    all: items.length,
    dead: 0,
    cooldown: 0,
    available: 0,
  }
  for (const item of items) counts[item.status] += 1
  return counts
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  meta,
  action,
}: {
  id: string
  icon: Icon
  title: string
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="sa-section-head">
      <div className="sa-section-text">
        <h2 id={id} className="sa-section-title">
          <Icon aria-hidden="true" />
          <T>{title}</T>
        </h2>
        {meta ? <p className="sa-section-meta">{meta}</p> : null}
      </div>
      {action}
    </header>
  )
}

/* ------------------------------------------------------------------------ */
/* Overview                                                                  */
/* ------------------------------------------------------------------------ */

function Overview({
  data,
  range,
  percent,
  stale,
}: {
  data: ScraperStatus
  stale: boolean
  range: ScraperRange
  percent: (part: number, whole: number) => string
}) {
  const { t } = useTranslation()
  const tiles: {
    href: string
    label: string
    icon: Icon
    tone: Tone
    value: string
    detail: string
  }[] = []

  const ig = data.instagram.data
  if (!ig)
    tiles.push({
      href: "#instagram-accounts-heading",
      label: "Instagram accounts",
      icon: InstagramLogoIcon,
      tone: "danger",
      value: t("Unreadable"),
      detail: t("Source error"),
    })
  else {
    const c = countStatuses(ig)
    tiles.push({
      href: "#instagram-accounts-heading",
      label: "Instagram accounts",
      icon: InstagramLogoIcon,
      tone: c.dead
        ? "danger"
        : c.cooldown
          ? "warning"
          : ig.length
            ? "ok"
            : "neutral",
      value: c.dead
        ? `${c.dead} ${t("dead")}`
        : c.cooldown
          ? `${c.cooldown} ${t("cooling down")}`
          : ig.length
            ? t("All available")
            : t("None"),
      detail: `${c.available}/${ig.length} ${t("available")}`,
    })
  }

  const tk = data.tiktok.data
  if (!tk)
    tiles.push({
      href: "#tiktok-identities-heading",
      label: "TikTok identities",
      icon: TiktokLogoIcon,
      tone: "danger",
      value: t("Unreadable"),
      detail: t("Source error"),
    })
  else {
    const c = countStatuses(tk)
    tiles.push({
      href: "#tiktok-identities-heading",
      label: "TikTok identities",
      icon: TiktokLogoIcon,
      tone: c.cooldown ? "warning" : tk.length ? "ok" : "neutral",
      value: c.cooldown
        ? `${c.cooldown} ${t("cooling down")}`
        : tk.length
          ? t("All available")
          : t("None"),
      detail: `${c.available}/${tk.length} ${t("available")}`,
    })
  }

  const fb = data.fallback.data
  const rangeLabel = ranges.find((r) => r.value === range)!.short
  tiles.push({
    href: "#instagram-fallback-heading",
    label: "Fallback share",
    icon: ShuffleIcon,
    tone: fb ? "neutral" : "danger",
    value: stale
      ? t("Updating…")
      : !fb
        ? t("Unreadable")
        : fb.successes
          ? percent(fb.fallbackSuccesses, fb.successes)
          : "—",
    detail: !fb ? t("Source error") : `${t("of successes")} · ${rangeLabel}`,
  })

  const alerts = {
    configured: {
      tone: "ok",
      value: "Configured",
      detail: "ntfy · configuration only",
    },
    disabled: {
      tone: "warning",
      value: "Not configured",
      detail: "No ntfy URL set",
    },
    invalid: {
      tone: "danger",
      value: "Invalid settings",
      detail: "Check ntfy environment",
    },
    demo: { tone: "neutral", value: "Off", detail: "Disabled in demo mode" },
  } as const satisfies Record<
    ScraperStatus["notifications"],
    { tone: Tone; value: string; detail: string }
  >
  const alert = alerts[data.notifications]
  tiles.push({
    href: "#instagram-alerts",
    label: "Dead-account alerts",
    icon: data.notifications === "configured" ? BellRingingIcon : BellSlashIcon,
    tone: alert.tone,
    value: t(alert.value),
    detail: t(alert.detail),
  })

  return (
    <nav aria-label={t("Status overview")} className="sa-overview">
      {tiles.map(({ href, label, icon: TileIcon, tone, value, detail }) => (
        <a key={label} href={href} className="sa-tile" data-tone={tone}>
          <span className="sa-tile-label">
            <TileIcon aria-hidden="true" />
            <T>{label}</T>
          </span>
          <span className="sa-tile-value">{value}</span>
          <span className="sa-tile-detail">{detail}</span>
        </a>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------------ */
/* Instagram                                                                 */
/* ------------------------------------------------------------------------ */

const notificationCopy: Record<
  ScraperStatus["notifications"],
  { tone: Tone; title: string; body: string }
> = {
  configured: {
    tone: "ok",
    title: "ntfy alerts configured.",
    body: "The background monitor checks every minute and alerts once per dead-account incident. This reflects configuration, not confirmed delivery.",
  },
  disabled: {
    tone: "warning",
    title: "ntfy alerts are not configured.",
    body: "Set INSTAGRAM_DEAD_NTFY_URL or VIDEO_INACTIVITY_NTFY_URL on the server.",
  },
  invalid: {
    tone: "danger",
    title: "Instagram alert configuration is invalid.",
    body: "Check the ntfy environment settings.",
  },
  demo: {
    tone: "neutral",
    title: "ntfy alerts are disabled in demo mode.",
    body: "",
  },
}

function InstagramSection({
  result,
  notifications,
  now,
  time,
  locale,
}: {
  result: SourceResult<InstagramAccount[]>
  notifications: ScraperStatus["notifications"]
  now: number
  time: BrowserTimeSettings
  locale: string
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const accounts = result.data
  const counts = useMemo(() => countStatuses(accounts ?? []), [accounts])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase().replace(/^@/, "")
    return (accounts ?? [])
      .filter((a) => filter === "all" || a.status === filter)
      .filter(
        (a) =>
          !needle ||
          [a.username, a.id, a.userId, a.deadReason].some((v) =>
            v?.toLowerCase().includes(needle)
          )
      )
      .sort(
        (a, b) =>
          statusMeta[a.status].rank - statusMeta[b.status].rank ||
          (Date.parse(b.deadAt ?? "") || 0) -
            (Date.parse(a.deadAt ?? "") || 0) ||
          (a.username ?? a.id).localeCompare(b.username ?? b.id)
      )
  }, [accounts, filter, search])
  const note = notificationCopy[notifications]
  const NoteIcon =
    note.tone === "danger" || note.tone === "warning"
      ? WarningCircleIcon
      : notifications === "configured"
        ? BellRingingIcon
        : BellSlashIcon

  return (
    <section
      aria-labelledby="instagram-accounts-heading"
      className="sa-section"
    >
      <SectionHeading
        id="instagram-accounts-heading"
        icon={InstagramLogoIcon}
        title="Instagram accounts"
        meta={
          <T>
            {
              "Available means no recorded death or active cooldown; it is not a live login check."
            }
          </T>
        }
      />
      <p
        id="instagram-alerts"
        role="status"
        className="sa-callout"
        data-tone={note.tone}
      >
        <NoteIcon aria-hidden="true" />
        <span>
          <span className="font-medium text-kumo-default">
            <T>{note.title}</T>
          </span>
          {note.body ? (
            <>
              {" "}
              <T>{note.body}</T>
            </>
          ) : null}
        </span>
      </p>
      {result.error !== null ? (
        <SourceError
          title="Could not read Instagram accounts."
          error={result.error}
        />
      ) : accounts!.length === 0 ? (
        <EmptyNote>
          <T>{"No accounts recorded by tt-scrap yet."}</T>
        </EmptyNote>
      ) : (
        <>
          {accounts!.length > 1 || filter !== "all" || search ? (
            <div className="sa-toolbar">
              <StatusFilter
                label="Filter Instagram accounts by status"
                value={filter}
                onChange={setFilter}
                counts={counts}
                statuses={["dead", "cooldown", "available"]}
              />
              {accounts!.length > 8 || search ? (
                <label className="sa-search">
                  <MagnifyingGlassIcon aria-hidden="true" />
                  <span className="sr-only">
                    <T>{"Search Instagram accounts"}</T>
                  </span>
                  <Input
                    type="search"
                    value={search}
                    placeholder={t("Username, ID or reason")}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {visible.length === 0 ? (
            <EmptyNote>
              <T>{"No accounts match this filter."}</T>
            </EmptyNote>
          ) : (
            <div className="sa-list" data-kind="instagram">
              <ColumnHeads
                labels={[
                  "Account",
                  "Status",
                  "Reason",
                  "Marked dead",
                  "Cooldown until",
                ]}
              />
              <ul aria-label={t("Instagram accounts")}>
                {visible.map((account) => (
                  <li
                    key={account.id}
                    className="sa-row"
                    data-tone={statusMeta[account.status].tone}
                  >
                    <div className="sa-identity">
                      <span className="sa-primary">
                        {account.username ? `@${account.username}` : account.id}
                      </span>
                      <span className="sa-secondary">
                        <span className="sa-mono">{account.id}</span>
                        {account.userId ? (
                          <>
                            {" · "}
                            <T>{"user"}</T>{" "}
                            <span className="sa-mono">{account.userId}</span>
                          </>
                        ) : null}
                      </span>
                    </div>
                    <div className="sa-state">
                      <StatusPill status={account.status} />
                    </div>
                    <dl className="sa-fields">
                      <Field label="Reason" empty={!account.deadReason}>
                        {account.deadReason ? (
                          <span className="sa-reason">
                            {account.deadReason}
                          </span>
                        ) : (
                          <Nothing />
                        )}
                      </Field>
                      <Field label="Marked dead" empty={!account.deadAt}>
                        <When
                          value={account.deadAt}
                          now={now}
                          time={time}
                          locale={locale}
                        />
                      </Field>
                      <Field
                        label="Cooldown until"
                        empty={!account.cooldownUntil}
                      >
                        <When
                          value={account.cooldownUntil}
                          now={now}
                          time={time}
                          locale={locale}
                        />
                      </Field>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------------ */
/* Fallback                                                                  */
/* ------------------------------------------------------------------------ */

function FallbackSection({
  result,
  range,
  onRangeChange,
  number,
  percent,
  stale,
}: {
  result: SourceResult<FallbackStats>
  stale: boolean
  range: ScraperRange
  onRangeChange: (range: ScraperRange) => void
  number: (value: number | string) => string
  percent: (part: number, whole: number) => string
}) {
  const { t } = useTranslation()
  const stats = result.data
  const rangeLabel = ranges.find((r) => r.value === range)!.label
  return (
    <section
      aria-labelledby="instagram-fallback-heading"
      aria-busy={stale || undefined}
      data-stale={stale || undefined}
      className="sa-section"
    >
      <SectionHeading
        id="instagram-fallback-heading"
        icon={ShuffleIcon}
        title="Instagram fallback usage"
        meta={
          <T>
            {
              "Legacy extraction attempts, including directly selected legacy requests — not completed video downloads. Cache hits excluded; periods use the attempt start time."
            }
          </T>
        }
        action={
          <ToggleGroup
            aria-label={t("Fallback period")}
            className="sa-period"
            value={[range]}
            onValueChange={(values) =>
              onRangeChange((values[0] as ScraperRange | undefined) ?? range)
            }
          >
            {ranges.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={t(option.label)}
                title={t(option.label)}
              >
                <T>{option.short}</T>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      {stale && (
        <p role="status" className="sa-section-meta">
          <T>{"Updating period… Previous values are shown below."}</T>
        </p>
      )}
      {result.error !== null ? (
        <SourceError
          title="Could not read fallback usage."
          error={result.error}
        />
      ) : stats!.attempts === 0 ? (
        <EmptyNote>
          <T>{"No Instagram attempts in this period."}</T>{" "}
          <span className="text-kumo-subtle">({t(rangeLabel)})</span>
        </EmptyNote>
      ) : (
        <FallbackBody stats={stats!} number={number} percent={percent} />
      )}
    </section>
  )
}

function FallbackBody({
  stats,
  number,
  percent,
}: {
  stats: FallbackStats
  number: (value: number | string) => string
  percent: (part: number, whole: number) => string
}) {
  const { t } = useTranslation()
  const appSuccesses = Math.max(0, stats.successes - stats.fallbackSuccesses)
  const outcomes = [
    {
      key: "success",
      label: "Succeeded",
      value: stats.fallbackSuccesses,
    },
    { key: "failure", label: "Failed", value: stats.fallbackFailures },
    {
      key: "pending",
      label: "Unfinished",
      value: stats.fallbackPending,
    },
  ]
  const share = (part: number, whole: number) =>
    whole > 0 ? `${(part / whole) * 100}%` : "0%"
  return (
    <div className="sa-fallback">
      <div className="sa-metric">
        <p className="sa-metric-label">
          <T>{"Fallback share of successful extractions"}</T>
        </p>
        <p className="sa-metric-value">
          {stats.successes
            ? percent(stats.fallbackSuccesses, stats.successes)
            : "—"}
          <span className="sa-metric-context">
            {number(stats.fallbackSuccesses)} / {number(stats.successes)}
          </span>
        </p>
        {stats.successes > 0 ? (
          <div
            role="img"
            aria-label={`${t("Fallback successes")}: ${number(stats.fallbackSuccesses)}; ${t("App successes")}: ${number(appSuccesses)}`}
            className="sa-bar"
          >
            {stats.fallbackSuccesses > 0 && (
              <span
                data-series="fallback"
                style={{
                  width: share(stats.fallbackSuccesses, stats.successes),
                }}
              />
            )}
            {appSuccesses > 0 && <span data-series="app" style={{ flex: 1 }} />}
          </div>
        ) : (
          <div className="sa-bar" aria-hidden="true" />
        )}
        <ul className="sa-legend">
          <li>
            <span aria-hidden="true" data-series="fallback" />
            <T>{"Fallback successes"}</T>
            <strong>{number(stats.fallbackSuccesses)}</strong>
          </li>
          <li>
            <span aria-hidden="true" data-series="app" />
            <T>{"App successes"}</T>
            <strong>{number(appSuccesses)}</strong>
          </li>
        </ul>
      </div>
      <div className="sa-metric">
        <p className="sa-metric-label">
          <T>{"Fallback attempts"}</T>
        </p>
        <p className="sa-metric-value">
          {number(stats.fallbackAttempts)}
          <span className="sa-metric-context">
            {percent(stats.fallbackAttempts, stats.attempts)} <T>{"of"}</T>{" "}
            {number(stats.attempts)} <T>{"Instagram attempts"}</T>
          </span>
        </p>
        {stats.fallbackAttempts > 0 ? (
          <div
            role="img"
            aria-label={`${t("Fallback attempt outcomes")}: ${outcomes
              .map((o) => `${t(o.label)} ${number(o.value)}`)
              .join(", ")}`}
            className="sa-bar"
          >
            {outcomes.map((o) =>
              o.value > 0 ? (
                <span
                  key={o.key}
                  data-series={o.key}
                  style={{ width: share(o.value, stats.fallbackAttempts) }}
                />
              ) : null
            )}
          </div>
        ) : (
          <div className="sa-bar" aria-hidden="true" />
        )}
        <ul className="sa-legend">
          {outcomes.map((o) => (
            <li key={o.key}>
              <span aria-hidden="true" data-series={o.key} />
              <T>{o.label}</T>
              <strong>{number(o.value)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* TikTok                                                                    */
/* ------------------------------------------------------------------------ */

function TikTokSection({
  result,
  now,
  time,
  locale,
  number,
}: {
  result: SourceResult<TikTokIdentity[]>
  now: number
  time: BrowserTimeSettings
  locale: string
  number: (value: number | string) => string
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>("all")
  const identities = result.data
  const counts = useMemo(() => countStatuses(identities ?? []), [identities])
  const visible = useMemo(
    () =>
      (identities ?? [])
        .filter((i) => filter === "all" || i.status === filter)
        .sort(
          (a, b) =>
            statusMeta[a.status].rank - statusMeta[b.status].rank ||
            b.failures - a.failures ||
            a.id.localeCompare(b.id)
        ),
    [identities, filter]
  )
  return (
    <section aria-labelledby="tiktok-identities-heading" className="sa-section">
      <SectionHeading
        id="tiktok-identities-heading"
        icon={TiktokLogoIcon}
        title="TikTok identities"
        meta={
          <T>
            {
              "Persisted checkpoints from tt-scrap. Availability includes identity and proxy cooldowns; live leases and credentials are not shown."
            }
          </T>
        }
      />
      {result.error !== null ? (
        <SourceError
          title="Could not read TikTok identities."
          error={result.error}
        />
      ) : identities!.length === 0 ? (
        <EmptyNote>
          <T>{"No accounts recorded by tt-scrap yet."}</T>
        </EmptyNote>
      ) : (
        <>
          {identities!.length > 1 || filter !== "all" ? (
            <div className="sa-toolbar">
              <StatusFilter
                label="Filter TikTok identities by status"
                value={filter}
                onChange={setFilter}
                counts={counts}
                statuses={["cooldown", "available"]}
              />
            </div>
          ) : null}
          {visible.length === 0 ? (
            <EmptyNote>
              <T>{"No identities match this filter."}</T>
            </EmptyNote>
          ) : (
            <div className="sa-list" data-kind="tiktok">
              <ColumnHeads
                labels={[
                  "Identity / proxy",
                  "Status",
                  "Assignments",
                  "Failures",
                  "Cooldown until",
                  "Last used",
                  "Checkpoint",
                ]}
              />
              <ul aria-label={t("TikTok identities")}>
                {visible.map((identity) => {
                  const hasFailures = Boolean(
                    identity.lastFailure || identity.proxyFailure
                  )
                  return (
                    <li
                      key={identity.id}
                      className="sa-row"
                      data-tone={statusMeta[identity.status].tone}
                    >
                      <div className="sa-identity">
                        <span className="sa-primary sa-mono">
                          {identity.id}
                        </span>
                        <span className="sa-secondary">
                          <T>{"Proxy"}</T>{" "}
                          <span className="sa-mono">{identity.proxyId}</span>
                          {" · "}
                          {identity.kind || t("Unknown")}
                        </span>
                      </div>
                      <div className="sa-state">
                        <StatusPill status={identity.status} />
                      </div>
                      <dl className="sa-fields">
                        <Field label="Assignments" numeric>
                          {number(identity.assignments)}
                        </Field>
                        <Field label="Failures" numeric>
                          <span
                            className={cn(
                              identity.failures > 0 && "text-kumo-danger"
                            )}
                          >
                            {number(identity.failures)}
                          </span>
                        </Field>
                        <Field
                          label="Cooldown until"
                          empty={!identity.cooldownUntil}
                        >
                          <When
                            value={identity.cooldownUntil}
                            now={now}
                            time={time}
                            locale={locale}
                          />
                        </Field>
                        <Field label="Last used" empty={!identity.lastUsedAt}>
                          <When
                            value={identity.lastUsedAt}
                            now={now}
                            time={time}
                            locale={locale}
                          />
                        </Field>
                        <Field label="Checkpoint">
                          <When
                            value={identity.updatedAt}
                            now={now}
                            time={time}
                            locale={locale}
                          />
                        </Field>
                      </dl>
                      {hasFailures ? (
                        <dl className="sa-failures">
                          {identity.lastFailure ? (
                            <div>
                              <dt>
                                <T>{"Last failure"}</T>
                              </dt>
                              <dd>{identity.lastFailure}</dd>
                            </div>
                          ) : null}
                          {identity.proxyFailure ? (
                            <div>
                              <dt>
                                <T>{"Proxy failure"}</T>
                              </dt>
                              <dd>{identity.proxyFailure}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------------ */
/* Page                                                                      */
/* ------------------------------------------------------------------------ */

export function ScraperAccountsPage() {
  const [range, setRange] = useState<ScraperRange>("24h")
  const { fakeMode } = useDashboardContext()
  const { t, locale } = useTranslation()
  const time = useBrowserTime()
  const now = useNow()
  const number = (value: number | string) =>
    new Intl.NumberFormat(locale).format(
      typeof value === "string" ? BigInt(value) : value
    )
  const percent = (part: number, whole: number) =>
    whole > 0
      ? new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(part / whole)
      : "—"
  const query = useQuery({
    queryKey: ["scraper-status", range],
    queryFn: ({ signal }) =>
      databaseAction(actions.getScraperStatus, { range }, signal, {
        quiet: true,
      }),
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  })
  const data = query.data
  const checkedAt = data ? Date.parse(data.checkedAt) : null

  return (
    <div className="scraper-accounts">
      <div className="sa-page-head">
        <PageHeading
          title="Scraper accounts"
          description="TikTok identity health, Instagram accounts, and fallback usage."
        />
        <div className="sa-refresh">
          <p className="sa-checked" aria-live="polite">
            {query.isFetching ? (
              <Spinner aria-label={t("Refreshing")} />
            ) : (
              <span aria-hidden="true" className="sa-live-dot" />
            )}
            {checkedAt ? (
              <span>
                <T>{"Last checked"}</T>{" "}
                <time
                  dateTime={data!.checkedAt}
                  title={formatTimestamp(checkedAt / 1000, time)}
                >
                  {formatEpoch(checkedAt / 1000, time, {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <span className="sa-checked-interval">
                  {" · "}
                  <T>{"Refreshes every minute"}</T>
                </span>
              </span>
            ) : (
              <T>{"Reading account status…"}</T>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <ArrowClockwiseIcon aria-hidden="true" />
            <T>{query.isFetching ? "Refreshing…" : "Refresh accounts"}</T>
          </Button>
        </div>
      </div>

      {fakeMode && (
        <p className="sa-callout" data-tone="neutral">
          <InfoIcon aria-hidden="true" />
          <span>
            <T>{"Demo data only. Notifications are disabled."}</T>
          </span>
        </p>
      )}

      {query.isError && (
        <div role="alert" className="sa-callout" data-tone="danger">
          <WarningCircleIcon aria-hidden="true" weight="fill" />
          <span className="flex-1">
            <T>
              {data
                ? "Could not refresh account status. Showing data from the last successful check."
                : "Could not load account status."}
            </T>
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <T>{"Try again"}</T>
          </Button>
        </div>
      )}

      {!data ? (
        query.isPending && (
          <DashboardLoading variant="summary-table" count={4} />
        )
      ) : (
        <div className="sa-body">
          <Overview
            data={data}
            range={range}
            percent={percent}
            stale={query.isPlaceholderData}
          />
          <InstagramSection
            result={data.instagram}
            notifications={data.notifications}
            now={now}
            time={time}
            locale={locale}
          />
          <FallbackSection
            result={data.fallback}
            range={range}
            onRangeChange={setRange}
            stale={query.isPlaceholderData}
            number={number}
            percent={percent}
          />
          <TikTokSection
            result={data.tiktok}
            now={now}
            time={time}
            locale={locale}
            number={number}
          />
        </div>
      )}
    </div>
  )
}
