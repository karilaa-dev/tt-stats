import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  return (
    <Dialog
      open={Boolean(selection) && authenticated}
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
        {selection && authenticated ? (
          <>
            {selection.mode === "media" ? (
              <MediaPreview key={selection.id} id={selection.id} />
            ) : (
              <DownloadersList key={selection.id} id={selection.id} />
            )}
            <a
              href={selection.sharedLink}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              Open original post <span className="sr-only">in a new tab</span>
            </a>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MediaPreview({ id }: { id: string }) {
  const query = useQuery(mediaQueryOptions(id))
  if (query.isPending) return <Spinner aria-label="Loading saved media" />
  if (query.isError) return <LoadError retry={() => void query.refetch()} />
  if (query.data.unavailableReason)
    return (
      <Alert>
        <AlertDescription>{query.data.unavailableReason}</AlertDescription>
      </Alert>
    )
  return (
    <div className="flex flex-col gap-4">
      {query.data.items.map((item) => (
        <MediaItem key={item.position} {...item} />
      ))}
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
  if (failed)
    return (
      <Alert>
        <AlertDescription>
          This saved file could not be displayed. It may be unavailable, exceed
          Telegram's 20 MB preview limit, or use an unsupported format. Open the
          original post.
        </AlertDescription>
      </Alert>
    )
  return mediaType === "video" ? (
    <video
      controls
      playsInline
      preload="metadata"
      src={url}
      aria-label={`Saved video ${position + 1}`}
      onError={() => setFailed(true)}
      className="max-h-[60dvh] w-full rounded-lg"
    />
  ) : (
    <img
      src={url}
      alt={`Downloaded image ${position + 1}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="max-h-[60dvh] w-full rounded-lg object-contain"
    />
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

function LoadError({ retry }: { retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-2">
        Could not load this download.
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
