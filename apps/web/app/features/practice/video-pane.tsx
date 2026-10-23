import { Maximize2Icon, Minimize2Icon, XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { correctVideo } from './model/video-sync'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { useVideoUrl } from './video-url'

// VideoPane (12 §2, 13 §6a): a URL import's downloaded video, muted (the stems are the sound),
// slaved to the master clock — rate = engine rate, re-seek on a loop wrap or drift over 80 ms,
// ±2 % nudges below that. The tab is the hero, so the video is a small player floating over the
// paper's corner, opened from the status bar; it can grow, shrink and close.

const CHECK_MS = 100

export function VideoPane({ className }: { className?: string }) {
  const { audio, player } = usePractice()
  const url = useVideoUrl()
  const video = useRef<HTMLVideoElement>(null)
  const large = usePracticeUi((s) => s.videoLarge)
  const rate = player.speedPct / 100

  useEffect(() => {
    let last = audio.position()
    const timer = setInterval(() => {
      const element = video.current
      if (!element || element.readyState < 2) return
      const now = audio.position()
      const playing = audio.playing()
      // A jump back (loop wrap, restart) is a re-seek, not drift.
      const wrapped = now < last - 0.25
      last = now
      if (!playing) {
        if (!element.paused) element.pause()
        if (Math.abs(element.currentTime - now) > 0.05) element.currentTime = now
        return
      }
      const correction = correctVideo(now, element.currentTime, rate, wrapped)
      if (correction.seek !== undefined) element.currentTime = correction.seek
      if (Math.abs(element.playbackRate - correction.playbackRate) > 1e-3) {
        element.playbackRate = correction.playbackRate
      }
      if (element.paused) void element.play().catch(() => undefined)
    }, CHECK_MS)
    return () => clearInterval(timer)
  }, [audio, rate])

  if (!url.data) return null
  return (
    <figure
      data-slot="video-pane"
      className={cn(
        'absolute right-4 bottom-4 z-(--z-sticky) m-0 aspect-video overflow-hidden rounded-xl border border-border bg-background shadow-3 motion-safe:animate-pop-in md:right-6',
        large ? 'w-[min(36rem,calc(100%-2rem))]' : 'w-[min(20rem,calc(100%-2rem))]',
        className,
      )}
    >
      <video
        ref={video}
        src={url.data.url}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-label={m['practice.video']()}
        className="h-full w-full object-contain"
      />
      <div className="absolute top-2 right-2 flex gap-1.5">
        <Button
          size="icon"
          className="bg-hud-bg text-hud-fg hover:bg-hud-bg"
          aria-label={large ? m['practice.video_smaller']() : m['practice.video_larger']()}
          onClick={() => usePracticeUi.setState({ videoLarge: !large })}
        >
          {large ? <Minimize2Icon aria-hidden /> : <Maximize2Icon aria-hidden />}
        </Button>
        <Button
          size="icon"
          className="bg-hud-bg text-hud-fg hover:bg-hud-bg"
          aria-label={m['practice.video_hide']()}
          onClick={() => usePracticeUi.setState({ videoOpen: false })}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
    </figure>
  )
}
