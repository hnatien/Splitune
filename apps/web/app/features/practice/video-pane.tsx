import { LayersIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Toggle } from '@/ui/toggle'
import { correctVideo } from './model/video-sync'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { useVideoUrl } from './video-url'

// VideoPane (12 §2, 13 §6a): a URL import's downloaded video, muted (the stems are the sound),
// slaved to the master clock — rate = engine rate, re-seek on a loop wrap or drift over 80 ms,
// ±2 % nudges below that. Notation may lie over a local video (no embed rules apply to a file).

const CHECK_MS = 100

export function VideoPane({ className }: { className?: string }) {
  const { audio, player } = usePractice()
  const url = useVideoUrl()
  const video = useRef<HTMLVideoElement>(null)
  const overlay = usePracticeUi((s) => s.videoOverlay)
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
    <div
      data-slot="video-pane"
      className={cn('relative min-h-[200px] overflow-hidden bg-background', className)}
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
      <Toggle
        size="practice-2"
        pressed={overlay}
        onPressedChange={(on) => usePracticeUi.setState({ videoOverlay: on })}
        className="absolute top-2 right-2 bg-card"
        aria-label={m['practice.notation_over_video']()}
      >
        <LayersIcon aria-hidden />
      </Toggle>
    </div>
  )
}
