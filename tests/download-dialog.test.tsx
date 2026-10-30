// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@/components/dashboard/admin-access", () => ({
  useAdminAccess: () => ({ authenticated: false }),
}))
vi.mock("@/lib/media/query-options", () => ({
  mediaQueryOptions: (id: string) => ({
    queryKey: ["media", id],
    queryFn: async () => ({
      unavailableReason: null,
      items: id.startsWith("audio:")
        ? [{ position: 0, mediaType: "audio", url: `/api/media/${id}/0` }]
        : [
            { position: 0, mediaType: "video", url: "/api/media/1/0" },
            { position: 1, mediaType: "photo", url: "/api/media/1/1" },
          ],
    }),
  }),
  downloadersQueryOptions: vi.fn(),
}))
import {
  DownloadDialog,
  type SelectedDownload,
} from "@/components/dashboard/download-dialog"

function renderDialog(selection: SelectedDownload) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DownloadDialog selection={selection} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {})
})
afterEach(cleanup)
describe("download preview", () => {
  it("renders video controls and album images, keeping the source link when a file fails", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <DownloadDialog
          selection={{
            id: "1",
            sharedLink: "https://example.test/post",
            mode: "media",
          }}
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    )
    const video = (await screen.findByLabelText(
      "Saved video 1"
    )) as HTMLVideoElement
    expect(video.controls).toBe(true)
    expect(video.getAttribute("src")).toBe("/api/media/1/0")
    expect(screen.queryByRole("img")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Next item" }))
    expect(video.getAttribute("src")).toBeNull()
    expect(video.pause).toHaveBeenCalled()
    const photo = screen.getByRole("img", { name: "Downloaded image 2" })
    expect(photo.getAttribute("src")).toBe("/api/media/1/1")
    fireEvent.error(photo)
    expect(
      screen.getByText(/This saved file could not be displayed/)
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: /Open original post/ })
        .getAttribute("href")
    ).toBe("https://example.test/post")
  })

  it("explains sound-only playback when the browser cannot decode the picture", async () => {
    renderDialog({
      id: "1",
      sharedLink: "https://example.test/post",
      mode: "media",
      videoId: "7539876543210000001",
      platform: "tiktok",
    })
    const video = (await screen.findByLabelText(
      "Saved video 1"
    )) as HTMLVideoElement
    // An H.265 file in a browser without an HEVC decoder: metadata loads,
    // but the picture has no dimensions.
    Object.defineProperty(video, "readyState", { value: 1 })
    Object.defineProperty(video, "videoWidth", { value: 0 })
    fireEvent.loadedMetadata(video)
    expect(
      screen.getByText("Only the sound can play in this browser")
    ).toBeTruthy()
    const download = screen.getByRole("link", { name: "Download video" })
    expect(download.getAttribute("href")).toBe("/api/media/1/0")
    expect(download.getAttribute("download")).toBe(
      "ttgrab-7539876543210000001-1.mp4"
    )
  })

  it("keeps a decodable video free of the sound-only notice", async () => {
    renderDialog({ id: "1", sharedLink: "", mode: "media" })
    const video = (await screen.findByLabelText(
      "Saved video 1"
    )) as HTMLVideoElement
    Object.defineProperty(video, "readyState", { value: 1 })
    Object.defineProperty(video, "videoWidth", { value: 1080 })
    fireEvent.loadedMetadata(video)
    fireEvent.playing(video)
    expect(
      screen.queryByText("Only the sound can play in this browser")
    ).toBeNull()
  })

  it("plays audio downloads in the audio player instead of a video frame", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined)
    renderDialog({
      id: "audio:7",
      sharedLink: "https://www.tiktok.com/@/video/7539876543210000001",
      mode: "audio",
      videoId: "7539876543210000001",
      platform: "tiktok",
    })
    expect(screen.getByRole("dialog", { name: "Saved audio" })).toBeTruthy()
    const player = await screen.findByRole("region", { name: "Audio player" })
    expect(screen.queryByLabelText("Saved video 1")).toBeNull()
    expect(player.textContent).toContain("TikTok sound")
    expect(player.textContent).toContain("7539876543210000001")
    const audio = player.querySelector("audio")!
    expect(audio.getAttribute("src")).toBe("/api/media/audio:7/0")
    Object.defineProperty(audio, "duration", { value: 125, configurable: true })
    fireEvent.loadedMetadata(audio)
    expect(player.textContent).toContain("2:05")
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    expect(play).toHaveBeenCalled()
    fireEvent.play(audio)
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy()
    expect(
      screen
        .getByRole("slider", { name: "Seek" })
        .getAttribute("aria-valuetext")
    ).toBe("Elapsed 0:00 of 2:05")
    fireEvent.click(screen.getByRole("button", { name: "Mute" }))
    expect(audio.muted).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Playback speed 1×" }))
    expect(audio.playbackRate).toBe(1.25)
  })
})
