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
      items: [
        { position: 0, mediaType: "video", url: "/api/media/1/0" },
        { position: 1, mediaType: "photo", url: "/api/media/1/1" },
      ],
    }),
  }),
  downloadersQueryOptions: vi.fn(),
}))
import { DownloadDialog } from "@/components/dashboard/download-dialog"

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
})
