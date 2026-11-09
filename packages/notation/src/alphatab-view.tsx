import * as alphaTab from '@coderline/alphatab'
import {
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { bravuraWoff2 } from './assets.ts'
import { externalMediaHandler, externalOutput, type MediaTarget } from './external-media.ts'
import {
  type BarBox,
  barBoxes,
  type CursorPosition,
  cursorAt,
  loopSpans,
  type MarkerBox,
  markerBoxes,
  type NoteBox,
  noteBoxes,
} from './geometry.ts'
import { applyTheme, inkColors, type ScoreTheme } from './resources.ts'
import { applyInk, applySyncPoints, loadScore, resolveTimeline } from './score.ts'
import type { BarTimes, BeatMarker, NotationTimeline, NoteMark, NoteRef } from './types.ts'

// <AlphaTabView> (12 §3, 26 §5, §10): owns one AlphaTabApi for its lifetime (never re-created on
// re-render), renders in alphaTab's Web Worker, and follows the audio clock. The display never owns
// the clock: every animation frame pushes the engine's heard position into alphaTab's external-media
// output and moves our own playhead by `transform`. Everything else is overlay: the current-bar
// wash and the loop wash beneath the score, the confidence marks, the shaky-bar outline, the loop
// bracket with its badge and the sounding fill above it, all positioned from boundsLookup (alphaTab's
// SVG is never styled with CSS). Bars are buttons (tap = loop selection, WCAG 2.5.7 single pointer;
// keyboard reachable with a roving tab stop).
//
// Steady playback reads no layout (28 §3.1): the scroller's size and offsets are cached from a
// ResizeObserver and its scroll events, page turns are decided once per bar, and the sounding fill
// changes once per beat.

export interface Clock {
  /** Heard position in seconds. */
  position(): number
  playing(): boolean
}

export interface AlphaTabViewHandle {
  /** The API, for diagnostics and tests. */
  readonly api: alphaTab.AlphaTabApi | null
  /** Moves keyboard focus to a bar's button (grid bar). */
  focusBar(bar: number): void
}

export type FollowMode = 'page' | 'scroll' | 'off'
export type PlayheadStyle = 'line' | 'block' | 'bar'

export interface AlphaTabViewProps {
  tex: string
  noteMap: readonly NoteRef[]
  marks: ReadonlyMap<string, NoteMark>
  markers?: readonly BeatMarker[]
  /** The beat grid (memoise it: a new object re-renders the score). */
  times: BarTimes
  theme: ScoreTheme
  /**
   * Notation follows the music (12 §3): page = systems turn as the playhead reaches the next one;
   * scroll = one line under a fixed now-line; off = it doesn't move (reading and fixing).
   */
  layout: FollowMode
  /** A 2 px line, a small block on the beat, or only the current bar's wash (12 §3). */
  playhead?: PlayheadStyle
  /** Reduced motion (26 §10): the playhead steps by beat. */
  stepped?: boolean
  clock: Clock
  media: MediaTarget
  showUncertainty: boolean
  /** Mostly-unsure bars (grid bars): one outline and one "?" instead of a mark per note (26 §5). */
  shakyBars?: ReadonlySet<number>
  /** Loop range in grid bars (inclusive). */
  loop?: { startBar: number; endBar: number } | null
  /** The loop bracket's badge ("Loop · bars 25–28 · pass 2 of 2 at 75 %"). */
  loopLabel?: string | undefined
  /** First bar tapped, waiting for the second (dashed shading). */
  armedBar?: number | null
  interaction: 'bars' | 'notes'
  selectedNoteId?: string | null
  barLabel: (bar: number) => string
  noteLabel?: (noteId: string) => string
  labels: { octaveUp: string; octaveDown: string; region: string }
  onBarActivate: (bar: number) => void
  onNoteActivate?: (noteId: string) => void
  onCurrentBarChange?: (bar: number) => void
  /** Milliseconds from handing the score to alphaTab until the render finished. */
  onRendered?: (ms: number) => void
  /** Smooth page turns (off under reduced motion: jumps). */
  smoothScroll?: boolean
  ref?: Ref<AlphaTabViewHandle>
  className?: string
}

interface Overlay {
  bars: BarBox[]
  notes: NoteBox[]
  markers: MarkerBox[]
}

const EMPTY: Overlay = { bars: [], notes: [], markers: [] }
// One empty list or set for every render: the overlay effect depends on them.
const NO_MARKERS: readonly BeatMarker[] = []
const NO_BARS: ReadonlySet<number> = new Set()
// Room above each system for the loop bracket and its badge (Main.dc.html), kept whether or not a
// loop exists so a new loop never re-lays out the score under the playhead. alphaTab's system
// bounds start below the top padding and their height counts both paddings.
const SYSTEM_TOP_PX = 44
const SYSTEM_BOTTOM_PX = 10
const PADDING_PX = SYSTEM_TOP_PX + SYSTEM_BOTTOM_PX

function createApi(host: HTMLElement, scroll: boolean): alphaTab.AlphaTabApi {
  const settings = new alphaTab.Settings()
  settings.core.engine = 'svg'
  settings.core.useWorkers = true
  settings.core.includeNoteBounds = true
  settings.core.smuflFontSources = new Map([[alphaTab.FontFileFormat.Woff2, bravuraWoff2]])
  settings.core.logLevel = alphaTab.LogLevel.Warning
  settings.display.layoutMode = scroll ? alphaTab.LayoutMode.Horizontal : alphaTab.LayoutMode.Page
  // Systems of four bars (Page) with room above each for the loop bracket (27 §3.7.1).
  if (!scroll) settings.display.barsPerRow = 4
  settings.display.firstSystemPaddingTop = SYSTEM_TOP_PX
  settings.display.systemPaddingTop = SYSTEM_TOP_PX
  settings.display.systemPaddingBottom = SYSTEM_BOTTOM_PX
  // Rhythm stems and beams under the tab, always (12 §3).
  settings.notation.rhythmMode = alphaTab.TabRhythmMode.ShowWithBars
  settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia
  settings.player.enableCursor = false
  settings.player.enableUserInteraction = false
  settings.player.scrollMode = alphaTab.ScrollMode.Off
  for (const element of [
    alphaTab.NotationElement.ScoreTitle,
    alphaTab.NotationElement.ScoreSubTitle,
    alphaTab.NotationElement.ScoreArtist,
    alphaTab.NotationElement.ScoreAlbum,
    alphaTab.NotationElement.ScoreWords,
    alphaTab.NotationElement.ScoreMusic,
    alphaTab.NotationElement.ScoreWordsAndMusic,
    alphaTab.NotationElement.ScoreCopyright,
    alphaTab.NotationElement.GuitarTuning,
    alphaTab.NotationElement.TrackNames,
    // The transport shows the tempo, and transcribed dynamics are noise on a practice tab.
    alphaTab.NotationElement.EffectTempo,
    alphaTab.NotationElement.EffectDynamics,
  ]) {
    settings.notation.elements.set(element, false)
  }
  return new alphaTab.AlphaTabApi(host, settings)
}

export function AlphaTabView({
  tex,
  noteMap,
  marks,
  markers = NO_MARKERS,
  times,
  theme,
  layout,
  playhead = 'line',
  stepped = false,
  clock,
  media,
  showUncertainty,
  shakyBars = NO_BARS,
  loop = null,
  loopLabel,
  armedBar = null,
  interaction,
  selectedNoteId = null,
  barLabel,
  noteLabel,
  labels,
  onBarActivate,
  onNoteActivate,
  onCurrentBarChange,
  onRendered,
  smoothScroll = true,
  ref,
  className,
}: AlphaTabViewProps) {
  const scroller = useRef<HTMLElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const wash = useRef<HTMLDivElement>(null)
  const sounding = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const scoreRef = useRef<alphaTab.model.Score | null>(null)
  const [timeline, setTimeline] = useState<NotationTimeline>({
    firstBar: times.firstBar,
    bars: [],
    end: 0,
  })
  const latest = useRef({
    clock,
    media,
    timeline,
    onCurrentBarChange,
    onRendered,
    smoothScroll,
    stepped,
    playhead,
  })
  latest.current = {
    clock,
    media,
    timeline,
    onCurrentBarChange,
    onRendered,
    smoothScroll,
    stepped,
    playhead,
  }
  const [overlay, setOverlay] = useState<Overlay>(EMPTY)
  const [currentBar, setCurrentBar] = useState(times.firstBar)
  const [lookupVersion, setLookupVersion] = useState(0)
  const renderStarted = useRef(0)
  // Page and Off share alphaTab's page layout; only Scrolling needs the horizontal one.
  const scroll = layout === 'scroll'

  // One API per mounted view and layout mode (alphaTab switches layout only at creation).
  useEffect(() => {
    const element = host.current
    if (!element) return
    const api = createApi(element, scroll)
    apiRef.current = api
    const handler = externalMediaHandler({ duration: () => latest.current.media.duration() })
    const attach = () => {
      const output = externalOutput(api)
      if (output) output.handler = handler
    }
    attach()
    const offReady = api.playerReady.on(attach)
    const offRendered = api.postRenderFinished.on(() => {
      latest.current.onRendered?.(performance.now() - renderStarted.current)
      setLookupVersion((v) => v + 1)
    })
    return () => {
      offReady()
      offRendered()
      api.destroy()
      apiRef.current = null
    }
  }, [scroll])

  // A changed score, ink, timeline or theme re-renders; overlay-only props don't.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    applyTheme(api.settings, theme)
    api.updateSettings()
    const score = loadScore(tex, api.settings)
    const resolved = resolveTimeline(score, times)
    applySyncPoints(score, resolved)
    applyInk(score, noteMap, marks, inkColors(theme))
    scoreRef.current = score
    latest.current.timeline = resolved
    setTimeline(resolved)
    renderStarted.current = performance.now()
    api.renderScore(score, [0])
  }, [tex, noteMap, marks, times, theme])

  // Marks and markers follow the latest render's bounds.
  useEffect(() => {
    const api = apiRef.current
    const lookup = api?.boundsLookup
    const score = scoreRef.current
    if (!lookup || !score || lookupVersion === 0) return
    setOverlay({
      bars: barBoxes(lookup),
      notes: noteBoxes(lookup, score, noteMap, marks),
      markers: markerBoxes(lookup, score, timeline, markers),
    })
  }, [lookupVersion, noteMap, marks, markers, timeline])

  // The frame loop: push the clock, move the playhead, turn pages while playing.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    // Cached scroller geometry: read on resize and scroll, never inside a frame.
    const view = { top: 0, left: 0, width: 0, height: 0 }
    const resize = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) {
        view.width = box.width
        view.height = box.height
      }
    })
    resize.observe(element)
    const onScroll = () => {
      view.top = element.scrollTop
      view.left = element.scrollLeft
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    // Scrolling waits for the end of the frame: after rendering the layout is clean, so the
    // scroll never forces one (the frame has already written the playhead and the fill).
    let scrollTask = 0
    const scrollAfterFrame = (to: ScrollToOptions) => {
      window.clearTimeout(scrollTask)
      scrollTask = window.setTimeout(() => element.scrollTo(to), 0)
    }
    let frame = 0
    let lastTime = Number.NaN
    let lastBar = -1
    let lastBeat: CursorPosition['beat'] | null = null
    let wasPlaying = false
    let lastStyle = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const api = apiRef.current
      const lookup = api?.boundsLookup
      const score = scoreRef.current
      const { clock: c, timeline: t, stepped: s, playhead: style } = latest.current
      const seconds = c.position()
      const playing = c.playing()
      if (!api || !lookup || !score) return
      if (seconds === lastTime && playing === wasPlaying && style === lastStyle) return
      lastTime = seconds
      lastStyle = style
      externalOutput(api)?.updatePosition(seconds * 1000)
      const at = cursorAt(lookup, score, t, seconds, s)
      const el = cursor.current
      if (!at || !el) return
      const block = style === 'block'
      el.style.transform = block
        ? `translate(${at.x - 6}px, ${at.y - 14}px)`
        : `translate(${at.x}px, ${at.y}px)`
      if (!block) el.style.height = `${Math.max(0, at.h - PADDING_PX)}px`
      el.setAttribute('data-time', seconds.toFixed(4))
      const turned = at.index !== lastBar || (playing && !wasPlaying)
      if (at.index !== lastBar) {
        lastBar = at.index
        const bar = t.firstBar + at.index
        setCurrentBar(bar)
        latest.current.onCurrentBarChange?.(bar)
        const found = barBoxes(lookup).find((b) => b.index === at.index)
        const box = found && barBody(found)
        const w = wash.current
        if (box && w) {
          w.style.transform = `translate(${box.x}px, ${box.y}px)`
          w.style.width = `${box.w}px`
          w.style.height = `${box.h}px`
        }
      }
      if (at.beat !== lastBeat || playing !== wasPlaying) {
        lastBeat = at.beat
        showSounding(sounding.current, playing ? at.beat : undefined)
      }
      wasPlaying = playing
      // Pausing stops any scrolling (WCAG 2.2.2); Off never scrolls.
      if (!playing || layout === 'off') return
      if (layout === 'scroll') {
        const left = Math.max(0, at.x - view.width / 3)
        if (Math.abs(view.left - left) > 1) {
          scrollAfterFrame({ left, behavior: 'auto' })
          view.left = left
        }
      } else if (turned) {
        const top = pageTop(view, lookup, at)
        if (top !== null) {
          scrollAfterFrame({ top, behavior: latest.current.smoothScroll ? 'smooth' : 'auto' })
        }
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(scrollTask)
      resize.disconnect()
      element.removeEventListener('scroll', onScroll)
    }
  }, [layout])

  useImperativeHandle(
    ref,
    () => ({
      get api() {
        return apiRef.current
      },
      focusBar: (bar) => buttons.current.get(bar - latest.current.timeline.firstBar)?.focus(),
    }),
    [],
  )

  const loopIndexes =
    loop === null
      ? null
      : { start: loop.startBar - timeline.firstBar, end: loop.endBar - timeline.firstBar }
  const focusIndex = (armedBar ?? currentBar) - timeline.firstBar
  const shaky = new Set([...shakyBars].map((bar) => bar - timeline.firstBar))
  const barOf = new Map(noteMap.map((ref) => [ref.noteId, ref.bar]))
  const shakyNote = (note: NoteBox) => shaky.has(barOf.get(note.noteId) ?? Number.NaN)

  const onBarKey = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0 || event.altKey || event.metaKey || event.ctrlKey) return
    const next = buttons.current.get(index + step)
    if (!next) return
    // Arrow keys move between bars here instead of seeking (the practice key map).
    event.preventDefault()
    event.stopPropagation()
    next.focus()
  }

  return (
    <section
      ref={scroller}
      aria-label={labels.region}
      data-slot="alphatab-view"
      data-layout={layout}
      data-playhead={playhead}
      className={[
        // Isolated: the overlay's layers stay below anything floating over the score (the video).
        'relative isolate min-h-0 overscroll-contain bg-paper text-ink',
        layout === 'scroll' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto',
        className ?? '',
      ].join(' ')}
    >
      <div className="relative w-full">
        {/* Washes beneath the score (26 §4.5, V17): the loop's bars, then the current bar. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          {overlay.bars.map((bar) => {
            const inLoop =
              loopIndexes !== null && bar.index >= loopIndexes.start && bar.index <= loopIndexes.end
            const armed = armedBar !== null && bar.index === armedBar - timeline.firstBar
            if (!inLoop && !armed) return null
            return (
              <div
                key={`shade-${bar.index}-${bar.system}`}
                data-slot="loop-shade"
                className={
                  armed && !inLoop
                    ? 'absolute rounded-xs border-2 border-dashed border-score-loop-edge'
                    : 'absolute bg-score-loop-fill'
                }
                style={boxStyle(barBody(bar))}
              />
            )
          })}
          <div
            ref={wash}
            data-slot="current-bar"
            className="absolute top-0 left-0 bg-bar-current will-change-transform"
          />
        </div>
        <div ref={host} className="relative z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
          {loopIndexes !== null &&
            loopSpans(overlay.bars, loopIndexes.start, loopIndexes.end).map((span) => (
              <LoopBracket
                key={`loop-${span.system}`}
                span={span}
                label={span.first ? loopLabel : undefined}
              />
            ))}
          {showUncertainty &&
            overlay.bars.map((bar) =>
              shaky.has(bar.index) ? (
                <span
                  key={`shaky-${bar.index}-${bar.system}`}
                  data-slot="shaky-bar"
                  className="absolute rounded-xs border-[1.5px] border-dashed border-unsure"
                  style={boxStyle(barBody(bar))}
                >
                  <Unsure />
                </span>
              ) : null,
            )}
          {overlay.notes.map((note) =>
            showUncertainty && !shakyNote(note) ? (
              <NoteMarks key={note.noteId} note={note} />
            ) : null,
          )}
          {overlay.notes.map((note) =>
            note.edited ? (
              <span
                key={`edited-${note.noteId}`}
                data-slot="edited-mark"
                className="absolute h-0.5 rounded-full bg-edited"
                style={{ left: note.x, top: note.y + note.h + 3, width: note.w }}
              />
            ) : null,
          )}
          {overlay.notes.map((note) =>
            note.octave ? (
              <span
                key={`8-${note.noteId}`}
                title={note.octave === '8va' ? labels.octaveUp : labels.octaveDown}
                className="absolute text-xs leading-none font-semibold"
                style={{ left: note.x + note.w, top: note.y - 10 }}
              >
                {note.octave}
              </span>
            ) : null,
          )}
          {overlay.markers.map((marker) => (
            <span
              key={`m-${marker.noteId}`}
              className="absolute -translate-x-1/2 text-sm leading-none font-bold"
              style={{ left: marker.x, top: marker.y + 2 }}
            >
              {marker.label}
            </span>
          ))}
          <div ref={sounding} data-slot="sounding" className="contents" />
          <div
            ref={cursor}
            data-slot="notation-cursor"
            data-style={playhead}
            className={
              playhead === 'block'
                ? 'absolute top-0 left-0 size-3 rounded-xs bg-score-playhead shadow-glow will-change-transform'
                : playhead === 'bar'
                  ? 'hidden'
                  : 'absolute top-0 left-0 w-0.5 rounded-full bg-score-playhead shadow-glow will-change-transform'
            }
          />
        </div>
        <div className="absolute inset-0 z-30">
          {overlay.bars.map((bar) => (
            <button
              key={`bar-${bar.index}-${bar.system}`}
              ref={(element) => {
                if (element) buttons.current.set(bar.index, element)
                else buttons.current.delete(bar.index)
              }}
              type="button"
              data-slot="bar-target"
              data-bar={timeline.firstBar + bar.index}
              tabIndex={bar.index === focusIndex ? 0 : -1}
              aria-label={barLabel(timeline.firstBar + bar.index)}
              aria-pressed={
                loopIndexes !== null &&
                bar.index >= loopIndexes.start &&
                bar.index <= loopIndexes.end
              }
              onClick={() => onBarActivate(timeline.firstBar + bar.index)}
              onKeyDown={onBarKey(bar.index)}
              className="absolute cursor-pointer rounded-sm bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
              style={boxStyle(barBody(bar))}
            />
          ))}
          {interaction === 'notes' &&
            overlay.notes.map((note) => (
              <button
                key={`note-${note.noteId}`}
                type="button"
                data-slot="note-target"
                data-note={note.noteId}
                tabIndex={-1}
                aria-label={noteLabel?.(note.noteId) ?? note.noteId}
                aria-pressed={selectedNoteId === note.noteId}
                onClick={() => onNoteActivate?.(note.noteId)}
                className="absolute min-h-6 min-w-6 cursor-pointer rounded-sm bg-transparent aria-pressed:outline-2 aria-pressed:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
                style={{
                  ...boxStyle(note),
                  left: note.x + note.w / 2,
                  top: note.y + note.h / 2,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
        </div>
      </div>
    </section>
  )
}

/** A bar's box without the system's paddings: its staff and what's drawn on it. */
function barBody(bar: BarBox): BarBox {
  return { ...bar, h: Math.max(0, bar.h - PADDING_PX) }
}

// The loop bracket (26 §12.2, Main.dc.html): a 2 px rail over the looped bars of a system with its
// ends turned down, and on the loop's first system the badge "Loop · bars 25–28 · pass 2 of 2 at
// 75 %" (decorative: the loop pill and the bars' pressed state carry it for assistive tech).
function LoopBracket({
  span,
  label,
}: {
  span: { x: number; y: number; w: number }
  label: string | undefined
}) {
  return (
    <>
      <span
        data-slot="loop-bracket"
        className="absolute h-3 rounded-t-sm border-2 border-b-0 border-score-loop-edge"
        style={{ left: span.x, top: span.y - 16, width: span.w }}
      />
      {label && (
        <span
          data-slot="loop-badge"
          className="absolute inline-flex h-5.5 items-center rounded-full bg-paper px-2 text-xs font-semibold whitespace-nowrap text-primary-ink tabular-nums inset-ring inset-ring-primary-line"
          style={{ left: span.x + 14, top: span.y - 38 }}
        >
          {label}
        </span>
      )}
    </>
  )
}

function boxStyle(box: { x: number; y: number; w: number; h: number }): CSSProperties {
  return { left: box.x, top: box.y, width: box.w, height: box.h }
}

/** The superscript "?" of an unsure mark (26 §5: 10 px, 700, `--unsure`). */
function Unsure() {
  return (
    <sup className="absolute -top-2.5 -right-2.5 text-2xs leading-none font-bold text-conf-low">
      ?
    </sup>
  )
}

// Confidence marks (26 §5): Probably a 1.5 px dashed `--conf-medium-edge` box 1 px off the digit,
// Unsure a dashed `--unsure` box with "?", a timing flag a dotted underline.
function NoteMarks({ note }: { note: NoteBox }) {
  if (note.level === 'high' && !note.timingFlagged) return null
  const pad = 2.5
  const style: CSSProperties = {
    left: note.x - pad,
    top: note.y - pad,
    width: note.w + pad * 2,
    height: note.h + pad * 2,
  }
  return (
    <span
      data-slot="note-mark"
      data-confidence={note.level}
      className={[
        'absolute rounded-xs',
        note.level === 'medium' ? 'border-[1.5px] border-dashed border-conf-medium-edge' : '',
        note.level === 'low' ? 'border-[1.5px] border-dashed border-conf-low' : '',
        note.timingFlagged && note.level === 'high'
          ? 'border-b-[1.5px] border-dotted border-ink'
          : '',
      ].join(' ')}
      style={style}
    >
      {note.level === 'low' && <Unsure />}
    </span>
  )
}

// The sounding fill (26 §5 "Sounding now"): the beat's fret digits as amber boxes with the digit in
// `--primary-foreground`, redrawn once per beat while playing (tab only; noteheads keep their ink).
function showSounding(container: HTMLElement | null, beat: CursorPosition['beat']) {
  if (!container) return
  container.replaceChildren()
  for (const bounds of beat?.notes ?? []) {
    const note = bounds.note
    if (!note.isStringed) continue
    const box = bounds.noteHeadBounds
    const fill = document.createElement('span')
    fill.setAttribute('data-slot', 'sounding-note')
    fill.className =
      'absolute grid place-items-center rounded-xs bg-primary font-reading-mono text-read-tab leading-none font-semibold text-primary-foreground shadow-glow'
    fill.style.left = `${box.x - 3}px`
    fill.style.top = `${box.y - 1}px`
    fill.style.width = `${box.w + 6}px`
    fill.style.height = `${box.h + 2}px`
    fill.textContent = String(note.fret)
    container.append(fill)
  }
}

// Page turns by staff system with at least the next bar in view (once per bar), from the cached
// scroller geometry: the top to scroll to, or null when the page stays.
function pageTop(
  view: { top: number; height: number },
  lookup: alphaTab.rendering.BoundsLookup,
  at: { index: number; x: number; y: number; h: number },
): number | null {
  const system = lookup.staffSystems.find((s) => s.bars.some((b) => b.index === at.index))
  if (!system) return null
  const bottom = view.top + view.height
  const lastOfSystem = system.bars.at(-1)?.index === at.index
  const next = lookup.staffSystems[system.index + 1]
  const needed = lastOfSystem && next ? next.realBounds.y + next.realBounds.h : at.y + at.h
  if (at.y >= view.top && needed <= bottom) return null
  // The system's own top room (its loop bracket and badge) stays in view.
  return Math.max(0, at.y - SYSTEM_TOP_PX)
}
