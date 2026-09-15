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
            {selection?.mode === "downloaders"
              ? "Other downloaders"
              : "Saved media"}
          </DialogTitle>
          <DialogDescription>
            {selection?.mode === "downloaders"
              ? "Other users and groups that downloaded this post. Counts include cache hits and misses."
              : "View the video or images saved for this post."}
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
                Open original post <span className="sr-only">in a new tab</span>
              </a>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MediaPreview({ id }: { id: string }) {
  const query = useQuery(mediaQueryOptions(id))
  const [index, setIndex] = useState(0)
  if (query.isPending) return <Spinner aria-label="Loading saved media" />
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
        <AlertDescription>{query.data.unavailableReason}</AlertDescription>
      </Alert>
    )
  const item = query.data.items[index]
  if (!item)
    return (
      <Alert>
        <AlertDescription>
          No saved media is available for this post.
        </AlertDescription>
      </Alert>
    )
  return (
    <div className="flex flex-col gap-3">
      <MediaItem key={`${id}:${item.position}`} {...item} />
      {query.data.items.length > 1 ? (
        <div
          className="flex items-center justify-between gap-3"
          aria-label="Album navigation"
        >
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            Previous item
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {index + 1} / {query.data.items.length}
          </span>
          <Button
            variant="outline"
            disabled={index >= query.data.items.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next item
          </Button>
        </div>
      ) : null}
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
            This saved file could not be displayed. It may exceed the 20 MB
            preview limit or use an unsupported format.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setFailed(false)
              setLoading(true)
              setAttempt(attempt + 1)
            }}
          >
            Retry preview
          </Button>
        </AlertDescription>
      </Alert>
    )
  return (
    <div className="media-stage" aria-busy={loading}>
      {loading ? (
        <span className="media-loading">
          <Spinner aria-label="Loading media" />
        </span>
      ) : null}
      {mediaType === "video" ? (
        <video
          ref={video}
          key={attempt}
          controls
          playsInline
          preload="metadata"
          src={url}
          aria-label={`Saved video ${position + 1}`}
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
          alt={`Downloaded image ${position + 1}`}
          onLoad={() => setLoading(false)}
          onError={() => {
            setFailed(true)
            setLoading(false)
          }}
        />
      )}
    </div>
  )
}

function DownloadersList({ id }: { id: string }) {
  const [page, setPage] = useState(1)
  const query = useQuery(downloadersQueryOptions(id, page))
  const time = useBrowserTime()
  if (query.isPending) return <Spinner aria-label="Loading other downloaders" />
  if (query.isError) return <LoadError retry={() => void query.refetch()} />
  return (
    <div className="flex flex-col gap-4">
      {query.data.items.length ? (
        <Table aria-label="Other downloaders">
          <TableHeader>
            <TableRow>
              <TableHead>Chat</TableHead>
              <TableHead>Downloads</TableHead>
              <TableHead>Last downloaded</TableHead>
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
                  {BigInt(item.downloads).toLocaleString("en-US")}
                </TableCell>
                <TableCell>
                  {item.lastDownloadedAt === null
                    ? "Unknown"
                    : formatTimestamp(item.lastDownloadedAt, time)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No other downloaders</EmptyTitle>
            <EmptyDescription>
              No other chats were found for this cached post.
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
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          disabled={!query.data.hasMore || query.isFetching}
          onClick={() => setPage(page + 1)}
        >
          Next
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
        {message}
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
