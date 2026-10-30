import { T, useTranslation } from "@/lib/i18n/provider"
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  SpeakerSlashIcon,
  WaveformIcon,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  Button,
  Slider,
  Spinner,
} from "@/components/controls"

const SKIP_SECONDS = 10
const SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const

/** m:ss, or h:mm:ss for long recordings. */
export function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--"
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`
}

/**
 * A compact player for a single saved sound. The file is streamed through the
 * authenticated media proxy; closing the player stops the download.
 */
export function AudioPlayer({
  url,
  title,
  details,
}: {
  url: string
  title: string
  details?: ReactNode
}) {
  const { t } = useTranslation()
  const audio = useRef<HTMLAudioElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(Number.NaN)
  const [position, setPosition] = useState(0)
  // While dragging, the thumb follows the pointer; the seek happens on release.
  const [scrub, setScrub] = useState<number | null>(null)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)

  useEffect(() => {
    const element = audio.current
    return () => {
      // Release the stream slot instead of buffering in the background.
      if (element) {
        element.pause()
        element.removeAttribute("src")
        element.load()
      }
    }
  }, [attempt, failed])

  const toggle = () => {
    const element = audio.current
    if (!element) return
    if (element.paused || element.ended) {
      if ("mediaSession" in navigator && typeof MediaMetadata === "function")
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: "@ttgrab",
        })
      void element.play().catch(() => {
        // Autoplay restrictions or a superseded request; state stays paused.
      })
    } else element.pause()
  }
  const seekTo = (seconds: number) => {
    const element = audio.current
    if (!element || !Number.isFinite(element.duration)) return
    element.currentTime = Math.max(0, Math.min(element.duration, seconds))
    setPosition(element.currentTime)
  }
  const skip = (offset: number) =>
    seekTo((audio.current?.currentTime ?? 0) + offset)

  if (failed)
    return (
      <Alert>
        <AlertDescription className="flex flex-col items-start gap-2">
          <T>
            {
              "This saved sound could not be played. It may exceed the 20 MB preview limit or use an unsupported format."
            }
          </T>
          <Button
            variant="outline"
            onClick={() => {
              setFailed(false)
              setReady(false)
              setPlaying(false)
              setPosition(0)
              setAttempt(attempt + 1)
            }}
          >
            <T>{"Try again"}</T>
          </Button>
        </AlertDescription>
      </Alert>
    )

  const known = Number.isFinite(duration) && duration > 0
  const shown = scrub ?? position
  const loading = !ready || buffering
  const VolumeIcon =
    muted || volume === 0
      ? SpeakerSlashIcon
      : volume < 0.5
        ? SpeakerLowIcon
        : SpeakerHighIcon
  return (
    <section
      className="audio-player"
      aria-label={t("Audio player")}
      data-playing={playing}
    >
      <audio
        ref={audio}
        key={attempt}
        src={url}
        preload="metadata"
        muted={muted}
        aria-label={t("Saved sound")}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration)
          setReady(true)
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => {
          setReady(true)
          setBuffering(false)
        }}
        onError={() => {
          setFailed(true)
          setPlaying(false)
        }}
      />
      <div className="audio-player-header">
        <span className="audio-player-art" aria-hidden="true">
          <WaveformIcon weight={playing ? "bold" : "regular"} />
        </span>
        <div className="audio-player-title">
          <p>
            <T>{title}</T>
          </p>
          {details ? (
            <div className="audio-player-details">{details}</div>
          ) : null}
        </div>
      </div>
      <div className="audio-player-timeline">
        <Slider
          label={t("Seek")}
          min={0}
          max={known ? duration : 1}
          step={0.1}
          largeStep={SKIP_SECONDS}
          value={known ? Math.min(shown, duration) : 0}
          disabled={!known}
          valueText={(value) =>
            t(
              `Elapsed ${formatPlaybackTime(value)} of ${formatPlaybackTime(duration)}`
            )
          }
          onValueChange={(value) => setScrub(value)}
          onValueCommitted={(value) => {
            setScrub(null)
            seekTo(value)
          }}
        />
        <div className="audio-player-times" aria-hidden="true">
          <span>{formatPlaybackTime(shown)}</span>
          <span>{known ? formatPlaybackTime(duration) : "--:--"}</span>
        </div>
      </div>
      <div className="audio-player-controls">
        <Button
          className="audio-player-speed"
          variant="ghost"
          size="sm"
          aria-label={t(`Playback speed ${speed}×`)}
          onClick={() => {
            const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!
            setSpeed(next)
            if (audio.current) audio.current.playbackRate = next
          }}
        >
          {`${speed}×`}
        </Button>
        <div className="audio-player-transport">
          <Button
            className="audio-player-skip"
            variant="ghost"
            size="sm"
            aria-label={t("Back 10 seconds")}
            disabled={!known}
            onClick={() => skip(-SKIP_SECONDS)}
          >
            <ArrowCounterClockwiseIcon />
            {SKIP_SECONDS}
          </Button>
          <Button
            className="audio-player-play"
            size="icon-lg"
            aria-label={t(playing ? "Pause" : "Play")}
            aria-busy={loading && playing}
            onClick={toggle}
          >
            {loading && playing ? (
              <Spinner aria-label={t("Loading sound")} />
            ) : playing ? (
              <PauseIcon weight="fill" />
            ) : (
              <PlayIcon weight="fill" />
            )}
          </Button>
          <Button
            className="audio-player-skip"
            variant="ghost"
            size="sm"
            aria-label={t("Forward 10 seconds")}
            disabled={!known}
            onClick={() => skip(SKIP_SECONDS)}
          >
            {SKIP_SECONDS}
            <ArrowClockwiseIcon />
          </Button>
        </div>
        <div className="audio-player-volume-group">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(muted ? "Unmute" : "Mute")}
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
          >
            <VolumeIcon />
          </Button>
          <Slider
            className="audio-player-volume"
            label={t("Volume")}
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            valueText={(value) => `${Math.round(value * 100)}%`}
            onValueChange={(value) => {
              setVolume(value)
              setMuted(value === 0)
              if (audio.current) audio.current.volume = value
            }}
          />
        </div>
      </div>
      {!ready && !playing ? (
        <p className="audio-player-status" role="status">
          <Spinner aria-label={t("Loading sound")} />
          <T>{"Loading sound…"}</T>
        </p>
      ) : null}
    </section>
  )
}
