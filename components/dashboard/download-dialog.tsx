import { T, useTranslation } from "@/lib/i18n/provider"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { safeExternalUrl } from "@/lib/security/links"
import { useSession } from "./session-access"
import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/controls"
import { Button, buttonVariants } from "@/components/controls"
import { Alert, AlertDescription } from "@/components/controls"
import { Spinner } from "@/components/controls"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/controls"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/controls"
import {
  mediaQueryOptions,
  downloadersQueryOptions,
} from "@/lib/media/query-options"
import { formatTimestamp, useBrowserTime } from "@/lib/browser-time"
import { useAdminAccess } from "./admin-access"

export interface SelectedDownload {
  id: string
  sharedLink: string
  mode: "media" | "downloaders"
}
export function DownloadDialog({
  selection,
  onClose,
}: {
  selection: SelectedDownload | null
  onClose: () => void
}) {
  const { authenticated } = useAdminAccess()
  const { user } = useSession()
  const previousIdentity = useRef(`${user?.id ?? ""}:${authenticated}`)
  useEffect(() => {
    const identity = `${user?.id ?? ""}:${authenticated}`
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity
      onClose()
    }
  }, [user?.id, authenticated, onClose])
  const allowed = selection?.mode === "media" || authenticated
  const original = safeExternalUrl(selection?.sharedLink)
  return (
    <Dialog
      open={Boolean(selection) && allowed}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <T>
              {selection?.mode === "downloaders"
                ? "Other downloaders"
                : "Saved media"}
            </T>
          </DialogTitle>
          <DialogDescription>
            <T>
              {selection?.mode === "downloaders"
                ? "Other users and groups that downloaded this post. Counts include cache hits and misses."
                : "View the video or images saved for this post."}
            </T>
          </DialogDescription>
        </DialogHeader>
        {selection && allowed ? (
          <>
            {selection.mode === "media" ? (
              <MediaPreview key={selection.id} id={selection.id} />
            ) : (
              <DownloadersList key={selection.id} id={selection.id} />
            )}
            {original ? (
              <a
                href={original}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <T>{"Open original post "}</T>
                <span className="sr-only">
                  <T>{"in a new tab"}</T>
                </span>
              </a>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MediaPreview({ id }: { id: string }) {
  const { t } = useTranslation()

  const query = useQuery(mediaQueryOptions(id))
  const [index, setIndex] = useState(0)
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(
    null
  )
  const items = query.data?.items ?? []
  const current = Math.min(index, Math.max(0, items.length - 1))
  const move = (offset: number) =>
    setIndex((value) => Math.max(0, Math.min(items.length - 1, value + offset)))
  if (query.isPending) return <Spinner aria-label={t("Loading saved media")} />
  if (query.isError)
    return (
      <LoadError
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  if (query.data.unavailableReason)
    return (
      <Alert>
        <AlertDescription>
          <T>{query.data.unavailableReason}</T>
        </AlertDescription>
      </Alert>
    )
  const item = items[current]
  if (!item)
    return (
      <Alert>
        <AlertDescription>
          <T>{"No saved media is available for this post."}</T>
        </AlertDescription>
      </Alert>
    )
  return (
    <div
      className="album-viewer"
      role="region"
      aria-label={t("Saved media slideshow")}
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "video, input, textarea, select"
          )
        )
          return
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault()
          move(event.key === "ArrowLeft" ? -1 : 1)
        }
      }}
    >
      <div
        className="album-stage"
        onPointerDown={(event) => {
          if (
            item.mediaType !== "photo" ||
            !event.isPrimary ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest("button")
          )
            return
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerUp={(event) => {
          const start = gesture.current
          gesture.current = null
          if (!start || start.pointerId !== event.pointerId) return
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
            move(dx < 0 ? 1 : -1)
        }}
        onPointerCancel={() => {
          gesture.current = null
        }}
      >
        <MediaItem key={`${id}:${item.position}`} {...item} />
        <T>
          {items.length > 1 ? (
            <>
              <Button
                className="album-arrow album-previous"
                variant="secondary"
                size="icon"
                aria-label={t("Previous item")}
                disabled={current === 0}
                onClick={() => move(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                className="album-arrow album-next"
                variant="secondary"
                size="icon"
                aria-label={t("Next item")}
                disabled={current >= items.length - 1}
                onClick={() => move(1)}
              >
                <ChevronRightIcon />
              </Button>
            </>
          ) : null}
        </T>
      </div>
      <T>
        {items.length > 1 ? (
          <div className="album-navigation" aria-label={t("Album navigation")}>
            <div className="album-dots" aria-hidden="true">
              <T>
                {items.map((_, i) =>
                  Math.abs(i - current) <= 3 ? (
                    <span key={i} data-current={i === current} />
                  ) : null
                )}
              </T>
            </div>
            <span aria-live="polite">
              <T>{current + 1}</T> / <T>{items.length}</T>
            </span>
          </div>
        ) : null}
      </T>
    </div>
  )
}
function MediaItem({
  url,
  mediaType,
  position,
}: {
  url: string
  mediaType: "photo" | "video"
  position: number
}) {
  const { t } = useTranslation()

  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const photo = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const element = video.current
    const image = photo.current
    return () => {
      if (element) {
        element.pause()
        element.removeAttribute("src")
        element.load()
      }
      image?.removeAttribute("src")
    }
  }, [attempt, failed])
  if (failed)
    return (
      <Alert>
        <AlertDescription>
          <p>
            <T>
              {
                "This saved file could not be displayed. It may exceed the 20 MB preview limit or use an unsupported format."
              }
            </T>
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setFailed(false)
              setLoading(true)
              setAttempt(attempt + 1)
            }}
          >
            <T>{"Retry preview"}</T>
          </Button>
        </AlertDescription>
      </Alert>
    )
  return (
    <div className="media-stage" aria-busy={loading}>
      <T>
        {loading ? (
          <span className="media-loading">
            <Spinner aria-label={t("Loading media")} />
          </span>
        ) : null}
      </T>
      <T>
        {mediaType === "video" ? (
          <video
            ref={video}
            key={attempt}
            controls
            playsInline
            preload="metadata"
            src={url}
            aria-label={t(`Saved video ${position + 1}`)}
            onLoadedMetadata={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            onPlaying={() => setLoading(false)}
            onWaiting={() => setLoading(true)}
            onError={() => {
              setFailed(true)
              setLoading(false)
            }}
          />
        ) : (
          <img
            ref={photo}
            key={attempt}
            src={url}
            draggable={false}
            alt={t(`Downloaded image ${position + 1}`)}
            onLoad={() => setLoading(false)}
            onError={() => {
              setFailed(true)
              setLoading(false)
            }}
          />
        )}
      </T>
    </div>
  )
}

function DownloadersList({ id }: { id: string }) {
  const { locale } = useTranslation()

  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const query = useQuery(downloadersQueryOptions(id, page))
  const time = useBrowserTime()
  if (query.isPending)
    return <Spinner aria-label={t("Loading other downloaders")} />
  if (query.isError) return <LoadError retry={() => void query.refetch()} />
  return (
    <div className="flex flex-col gap-4">
      {query.data.items.length ? (
        <Table aria-label={t("Other downloaders")}>
          <TableHeader>
            <TableRow>
              <TableHead>
                <T>{"Chat"}</T>
              </TableHead>
              <TableHead>
                <T>{"Downloads"}</T>
              </TableHead>
              <TableHead>
                <T>{"Last downloaded"}</T>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.items.map((item) => (
              <TableRow key={item.userId}>
                <TableCell>
                  <a
                    className="text-primary underline"
                    href={`/dashboard/users?id=${encodeURIComponent(item.userId)}`}
                  >
                    {item.userId}
                  </a>
                </TableCell>
                <TableCell>
                  <T>{BigInt(item.downloads).toLocaleString(locale)}</T>
                </TableCell>
                <TableCell>
                  <T>
                    {item.lastDownloadedAt === null
                      ? "Unknown"
                      : formatTimestamp(item.lastDownloadedAt, time)}
                  </T>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              <T>{"No other downloaders"}</T>
            </EmptyTitle>
            <EmptyDescription>
              <T>{"No other chats were found for this cached post."}</T>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage(page - 1)}
        >
          <T>{"Previous"}</T>
        </Button>
        <span className="text-sm text-muted-foreground">
          <T>{"Page "}</T>
          <T>{page}</T>
        </span>
        <Button
          variant="outline"
          disabled={!query.data.hasMore || query.isFetching}
          onClick={() => setPage(page + 1)}
        >
          <T>{"Next"}</T>
        </Button>
      </div>
    </div>
  )
}

function LoadError({
  retry,
  message = "Could not load this download.",
}: {
  retry: () => void
  message?: string
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-2">
        <T>{message}</T>
        <Button variant="outline" onClick={retry}>
          <T>{"Try again"}</T>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
