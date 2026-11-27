import type { LibrarySong } from '@splitune/contracts'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import { formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { isMissingStill, youtubeStill, youtubeVideoId } from '@/lib/youtube'
import { WaveformBars } from '@/ui/waveform-bars'
import { INSTRUMENT_ICON } from './instrument-icon'

type Song = z.infer<typeof LibrarySong>

const CHIP =
  'absolute flex h-6 max-w-[calc(100%-1rem)] items-center rounded-media bg-background px-2 text-caption font-medium text-foreground tabular-nums'

/** How far into the song the learner stopped, 0–1 (0 when it was never played or has no length). */
export function playedShare(song: Song): number {
  const at = song.player_state.position_s ?? 0
  return song.duration_s && at > 0 ? Math.min(1, at / song.duration_s) : 0
}

// A song's picture in the library (27 §3.5): a 16:9 well with the media radius and no border.
// A tile shows the still of the video the song came from; a song with no still (an upload, a
// recording, a link that isn't a video, a still that has gone) shows its waveform, and a song not
// decoded on any device yet shows its instrument's drawing. The lead (`lead`) always shows the
// waveform, with an ink line and the time where the learner stopped. On top: the length, a line
// along the foot for how far they got (ink over a grey track), and `chip`, the state of a song
// that isn't playable yet. The picture and the foot line are decorative; the chip's words are not.
export function SongMedia({
  song,
  lead = false,
  bars,
  chip,
  className,
}: {
  song: Song
  lead?: boolean
  /** Waveform bars to draw: fewer in a narrow box. */
  bars: number
  chip?: React.ReactNode
  className?: string
}) {
  const videoId = lead ? null : youtubeVideoId(song.source_url)
  const [gone, setGone] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  // A still that finished loading before hydration never fires onLoad here.
  useEffect(() => {
    const element = image.current
    if (element?.complete && isMissingStill(element)) setGone(true)
  }, [])
  const played = playedShare(song)
  const shows = videoId && !gone ? 'still' : song.waveform ? 'waveform' : 'drawing'
  const Instrument = INSTRUMENT_ICON[song.instrument]
  // The time sits after the line, or before it once the line is past the middle.
  const stoppedAt = lead && played > 0 ? formatDuration(song.player_state.position_s ?? 0) : null
  return (
    <div
      data-slot="song-media"
      data-shows={shows}
      className={cn('relative aspect-video overflow-hidden rounded-media bg-panel', className)}
    >
      {shows === 'still' && videoId && (
        <img
          ref={image}
          src={youtubeStill(videoId)}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onLoad={(event) => {
            if (isMissingStill(event.currentTarget)) setGone(true)
          }}
          onError={() => setGone(true)}
        />
      )}
      {shows === 'waveform' && song.waveform && (
        <WaveformBars
          levels={song.waveform}
          bars={bars}
          played={played}
          className="absolute inset-x-0 top-1/4 h-1/2"
        />
      )}
      {shows === 'drawing' && (
        <Instrument
          aria-hidden
          className={cn(
            'absolute inset-0 m-auto stroke-[1.25] text-edge',
            lead ? 'size-16' : 'size-11',
          )}
        />
      )}
      {stoppedAt && (
        <>
          <span
            aria-hidden
            className="absolute top-10 bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-playhead"
            style={{ left: `${played * 100}%` }}
          />
          <span
            data-slot="stopped-at"
            className={cn(
              'absolute top-3 text-caption whitespace-nowrap text-muted-foreground tabular-nums',
              played > 0.5 && '-translate-x-full',
            )}
            style={{ left: `calc(${played * 100}% + ${played > 0.5 ? '-0.5rem' : '0.5rem'})` }}
          >
            {m['library.stopped_at']({ time: stoppedAt })}
          </span>
        </>
      )}
      {chip && <span className={cn(CHIP, 'top-2 left-2')}>{chip}</span>}
      {song.duration_s !== null && (
        <span aria-hidden className={cn(CHIP, 'right-2 bottom-3')}>
          {formatDuration(song.duration_s)}
        </span>
      )}
      {played > 0 && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-border-strong">
          <span className="block h-full bg-foreground" style={{ width: `${played * 100}%` }} />
        </span>
      )}
    </div>
  )
}
