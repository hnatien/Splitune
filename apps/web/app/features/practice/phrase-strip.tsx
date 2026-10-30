import { degreeName } from '@splitune/notation'
import {
  ArrowRightIcon,
  ChevronDownIcon,
  RepeatIcon,
  SlidersHorizontalIcon,
  Volume2Icon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { Toggle } from '@/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { OptionSegments } from '../common/option-segments'
import { type GuideLevel, guideLevel, withGuide } from './model/mixer'
import { loopedPhrase, phraseAtTime } from './model/phrases'
import { spelledNote } from './model/view-model'
import { usePractice } from './practice-context'

// The strip over vocals' melody (step 18c), in place of the chord strip: the phrase being sung
// (its number, its letter, A′ for a repeat, and its bars), the note it starts on with its scale
// degree and a cue to hear it, then the next phrase and how many beats away it is, so the entry
// is seen coming. At the end: the singer's range, the phrase loop, the guide vocal (the part's
// level in the mixer: on, quiet or off) and the melody's options. Phones keep the phrase, its
// first note, the cue and the loop.

// Beyond this many beats the next phrase is named by its bar.
const COUNT_BEATS = 8

interface Now {
  /** The phrase being sung, or -1 in a rest. */
  current: number
  /** The phrase to sing next, or -1 after the last. */
  next: number
  beats: number
  /** The phrase that's been entered (sung or rested after), for the loop button. */
  entered: number
}

const label = 'text-xs font-semibold tracking-wide text-conf-medium uppercase'

/** "bars 10–13", or "bar 4" for a phrase inside one bar (1-based, as the UI shows bars). */
export function phraseBars(startBar: number, endBar: number): string {
  return startBar === endBar
    ? m['practice.phrase_bar']({ bar: String(startBar + 1) })
    : m['practice.phrase_bars']({ from: String(startBar + 1), to: String(endBar + 1) })
}

export function PhraseStrip({ compact = false }: { compact?: boolean }) {
  const { music, grid, audio, player, channels, mix, setMix, loopPhrase, cueNote } = usePractice()
  const melody = music?.melody
  const phrases = melody?.phrases ?? []
  const [now, setNow] = useState<Now>({ current: -1, next: -1, beats: 0, entered: -1 })

  useEffect(() => {
    if (!grid || !melody) return
    let frame = 0
    let previous = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const t = audio.position()
      const entered = phraseAtTime(grid, melody.phrases, t)
      const phrase = melody.phrases[entered]
      const singing = phrase !== undefined && t >= phrase.t0 - 0.05 && t <= phrase.t1
      const next = melody.phrases.findIndex((p) => p.t0 > t + 0.05)
      const ahead = melody.phrases[next]
      const beats = ahead
        ? Math.max(
            0,
            Math.round(
              grid.grid.times.filter((time) => time > t + 1e-3 && time <= ahead.t0 + 0.05).length,
            ),
          )
        : 0
      const state: Now = { current: singing ? entered : -1, next, beats, entered }
      const key = `${state.current}|${state.next}|${state.beats}|${state.entered}`
      if (key === previous) return
      previous = key
      setNow(state)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audio, grid, melody])

  if (!melody || !music) return null
  const tonic = melody.scale[0] ?? 0
  const current = phrases[now.current]
  const next = phrases[now.next]
  // The note to pitch from: this phrase's while it's sung, else the next one's.
  const starting = current ?? next
  const startNote = starting ? melody.notes[starting.first] : undefined
  const name = (pitch: number) => spelledNote(pitch, music.noteNames)
  const nextLabel = !next
    ? ''
    : now.beats <= 1
      ? m['practice.next_on_beat']()
      : now.beats <= COUNT_BEATS
        ? m['practice.next_in_beats']({ count: String(now.beats) })
        : m['practice.next_at_bar']({ bar: String(next.startBar + 1) })
  const nextFirst = next ? melody.notes[next.first] : undefined
  const looped = loopedPhrase(phrases, player.loopOn ? player.loop : null)
  const loopTarget = looped >= 0 ? looped : now.entered >= 0 ? now.entered : now.next
  const guide = guideLevel(channels, mix)
  const letter = (p: (typeof phrases)[number]) => `${p.letter}${p.repeat ? '′' : ''}`

  return (
    <div
      data-slot="phrase-strip"
      className="@container flex min-w-0 flex-1 items-center gap-4 py-1 @3xl:gap-6"
    >
      <div className="flex shrink-0 flex-col items-start gap-1">
        <span className={label}>
          {current
            ? m['practice.phrase_now']({
                n: String(now.current + 1),
                count: String(phrases.length),
              })
            : m['practice.phrase_rest']()}
        </span>
        <span
          data-slot="phrase-now"
          className={cn(
            'flex items-baseline gap-2 font-reading leading-none font-bold',
            compact ? 'text-read-chord' : 'text-read-chord-current',
          )}
        >
          {current ? letter(current) : '—'}
          {current && (
            <span className="text-read-label font-semibold text-conf-medium">
              {phraseBars(current.startBar, current.endBar)}
            </span>
          )}
        </span>
      </div>

      {startNote && (
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col items-start gap-1">
            <span className={label}>{m['practice.phrase_starts_on']()}</span>
            <span data-slot="phrase-start" className="font-reading text-read-chord font-semibold">
              {name(startNote.pitch)}{' '}
              <span className="text-read-label text-conf-medium">
                ({degreeName(startNote.pitch, tonic)})
              </span>
            </span>
          </div>
          <Button
            variant="outline"
            size={compact ? 'icon-practice-2' : 'practice-2'}
            className="border-staff bg-paper text-ink hover:bg-bar-current"
            aria-label={m['practice.first_note_label']({ note: name(startNote.pitch) })}
            onClick={cueNote}
          >
            <Volume2Icon aria-hidden />
            {!compact && <span className="hidden @4xl:inline">{m['practice.first_note']()}</span>}
          </Button>
        </div>
      )}

      {next && nextFirst && !compact && (
        <>
          <ArrowRightIcon aria-hidden className="size-6 shrink-0 text-staff" />
          <div className="flex shrink-0 flex-col items-start gap-1">
            <span className={label}>{nextLabel}</span>
            <span data-slot="phrase-next" className="font-reading text-read-chord font-semibold">
              {now.next + 1} · {letter(next)}{' '}
              <span className="text-read-label text-conf-medium">
                {m['practice.phrase_on']({ note: name(nextFirst.pitch) })}
              </span>
            </span>
          </div>
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {melody.range && !compact && (
          <span
            data-slot="vocal-range"
            className="hidden items-baseline gap-2 rounded-lg border border-staff px-3 py-2 font-reading text-read-label @5xl:flex"
          >
            <span className="sr-only">
              {m['practice.range_label']({
                low: name(melody.range.low),
                high: name(melody.range.high),
              })}
            </span>
            <span aria-hidden className="text-conf-medium">
              {m['practice.range']()}
            </span>
            <span aria-hidden className="font-semibold">
              {name(melody.range.low)}–{name(melody.range.high)}
            </span>
          </span>
        )}
        {loopTarget >= 0 && (
          <Toggle
            variant="outline"
            size="practice-2"
            className="border-staff bg-paper px-0 text-ink hover:bg-bar-current data-pressed:border-score-loop-edge data-pressed:bg-score-loop-fill data-pressed:text-ink"
            pressed={looped >= 0}
            onPressedChange={() => loopPhrase(looped >= 0 ? looped : loopTarget)}
            aria-label={m['practice.loop_phrase']()}
          >
            <RepeatIcon aria-hidden className="size-6" />
          </Toggle>
        )}
        {guide && !compact && (
          <ToggleGroup
            aria-label={m['practice.guide_vocal']()}
            value={[guide]}
            onValueChange={(value) => {
              const level = value[0] as GuideLevel | undefined
              if (level) setMix(withGuide(channels, mix, level))
            }}
            className="hidden border border-staff bg-paper @4xl:flex"
            capsuleClassName="border-ink bg-bar-current"
          >
            {(['on', 'quiet', 'off'] as const).map((level) => (
              <ToggleGroupItem
                key={level}
                value={level}
                className="px-3 text-sm text-ink hover:bg-bar-current data-pressed:border-ink data-pressed:bg-bar-current data-pressed:text-ink"
              >
                {level === 'on'
                  ? m['practice.guide_on']()
                  : level === 'quiet'
                    ? m['practice.guide_quiet']()
                    : m['practice.guide_off']()}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {!compact && <MelodyOptions guide={guide} />}
      </div>
    </div>
  )
}

// The melody's options: what the notes say, the pitch range shown, and (where the strip has no
// room for its switch) the guide vocal. Practice defaults, this device. It sits on the paper with
// the score's ink, and Stage keeps it out, as piano's options do.
function MelodyOptions({ guide }: { guide: GuideLevel | null }) {
  const { channels, mix, setMix } = usePractice()
  const labels = usePracticeDefaults((s) => s.melodyLabels)
  const pitchWindow = usePracticeDefaults((s) => s.melodyWindow)
  const update = usePracticeDefaults((s) => s.update)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="practice-2"
            className="shrink-0 border-staff bg-paper text-ink hover:bg-bar-current in-data-[appearance=stage]:hidden"
            aria-label={m['practice.melody_options']()}
          />
        }
      >
        <SlidersHorizontalIcon aria-hidden />
        <ChevronDownIcon aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] gap-4">
        <PopoverTitle>{m['practice.melody_options']()}</PopoverTitle>
        <OptionSegments
          label={m['practice.melody_labels']()}
          value={labels}
          options={[
            { value: 'names', label: m['practice.melody_labels_names']() },
            { value: 'degrees', label: m['practice.melody_labels_degrees']() },
            { value: 'off', label: m['practice.melody_labels_off']() },
          ]}
          onChange={(melodyLabels) => update({ melodyLabels })}
        />
        <OptionSegments
          label={m['practice.melody_window']()}
          value={pitchWindow}
          options={[
            { value: 'follow', label: m['practice.melody_window_follow']() },
            { value: 'whole', label: m['practice.melody_window_whole']() },
          ]}
          onChange={(melodyWindow) => update({ melodyWindow })}
        />
        {guide && (
          <OptionSegments
            label={m['practice.guide_vocal']()}
            value={guide}
            options={[
              { value: 'on', label: m['practice.guide_on']() },
              { value: 'quiet', label: m['practice.guide_quiet']() },
              { value: 'off', label: m['practice.guide_off']() },
            ]}
            onChange={(level) => setMix(withGuide(channels, mix, level))}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
