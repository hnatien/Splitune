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
  cursorAt,
  type MarkerBox,
  markerBoxes,
  type NoteBox,
  noteBoxes,
} from './geometry.ts'
import { applyTheme, inkColors, type ScoreTheme } from './resources.ts'
import { applyInk, applySyncPoints, loadScore, resolveTimeline } from './score.ts'
import type { BarTimes, BeatMarker, NotationTimeline, NoteMark, NoteRef } from './types.ts'

// <AlphaTabView> (12 §3): owns one AlphaTabApi for its lifetime (never re-created on re-render),
// renders in alphaTab's Web Worker, and follows the audio clock. The display never owns the clock:
// every animation frame pushes the engine's heard position into alphaTab's external-media output
// and draws our own beat cursor, current-bar wash and loop shading from boundsLookup, so the
// cursor is computed from the same clock as everything else. Bars are buttons (tap = loop
// selection, WCAG 2.5.7 single pointer; keyboard reachable with a roving tab stop).

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

export interface AlphaTabViewProps {
  tex: string
  noteMap: readonly NoteRef[]
  marks: ReadonlyMap<string, NoteMark>
  markers?: readonly BeatMarker[]
  /** The beat grid (memoise it: a new object re-renders the score). */
  times: BarTimes
  theme: ScoreTheme
  /** page = systems that flip by bar group; scroll = one line under a fixed now-line. */
  layout: 'page' | 'scroll'
  clock: Clock
  media: MediaTarget
  showUncertainty: boolean
  /** Loop range in grid bars (inclusive). */
  loop?: { startBar: number; endBar: number } | null
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
  /** Smooth page flips (off under reduced motion: jumps). */
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
const LOOK_AHEAD_PX = 8

function createApi(host: HTMLElement, layout: 'page' | 'scroll'): alphaTab.AlphaTabApi {
  const settings = new alphaTab.Settings()
  settings.core.engine = 'svg'
  settings.core.useWorkers = true
  settings.core.includeNoteBounds = true
  settings.core.smuflFontSources = new Map([[alphaTab.FontFileFormat.Woff2, bravuraWoff2]])
  settings.core.logLevel = alphaTab.LogLevel.Warning
  settings.display.layoutMode =
    layout === 'scroll' ? alphaTab.LayoutMode.Horizontal : alphaTab.LayoutMode.Page
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
  ]) {
    settings.notation.elements.set(element, false)
  }
  return new alphaTab.AlphaTabApi(host, settings)
}

export function AlphaTabView({
  tex,
  noteMap,
  marks,
  markers = [],
  times,
  theme,
  layout,
  clock,
  media,
  showUncertainty,
  loop = null,
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
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const scoreRef = useRef<alphaTab.model.Score | null>(null)
  const [timeline, setTimeline] = useState<NotationTimeline>({
    firstBar: times.firstBar,
    bars: [],
    end: 0,
  })
  const latest = useRef({ clock, media, timeline, onCurrentBarChange, onRendered, smoothScroll })
  latest.current = { clock, media, timeline, onCurrentBarChange, onRendered, smoothScroll }
  const [overlay, setOverlay] = useState<Overlay>(EMPTY)
  const [currentBar, setCurrentBar] = useState(times.firstBar)
  const [lookupVersion, setLookupVersion] = useState(0)
  const renderStarted = useRef(0)

  // One API per mounted view and layout mode (alphaTab switches layout only at creation).
  useEffect(() => {
    const element = host.current
    if (!element) return
    const api = createApi(element, layout)
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
  }, [layout])

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

  // The frame loop: push the clock, move the cursor, flip pages while playing.
  useEffect(() => {
    let frame = 0
    let lastTime = Number.NaN
    let lastBar = -1
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const api = apiRef.current
      const lookup = api?.boundsLookup
      const score = scoreRef.current
      const { clock: c, timeline: t } = latest.current
      const seconds = c.position()
      if (!api || !lookup || !score || seconds === lastTime) return
      lastTime = seconds
      externalOutput(api)?.updatePosition(seconds * 1000)
      const at = cursorAt(lookup, score, t, seconds)
      const el = cursor.current
      if (!at || !el) return
      el.style.transform = `translate(${at.x}px, ${at.y}px)`
      el.style.height = `${at.h}px`
      el.setAttribute('data-time', seconds.toFixed(4))
      if (at.index !== lastBar) {
        lastBar = at.index
        const bar = t.firstBar + at.index
        setCurrentBar(bar)
        latest.current.onCurrentBarChange?.(bar)
        const box = barBoxes(lookup).find((b) => b.index === at.index)
        const w = wash.current
        if (box && w) {
          w.style.transform = `translate(${box.x}px, ${box.y}px)`
          w.style.width = `${box.w}px`
          w.style.height = `${box.h}px`
        }
      }
      if (c.playing()) follow(scroller.current, lookup, at, layout, latest.current.smoothScroll)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
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
      className={[
        'relative min-h-0 overscroll-contain bg-paper text-ink',
        layout === 'scroll' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto',
        className ?? '',
      ].join(' ')}
    >
      <div className="relative w-full">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          {/* Under the loop shading: inside the loop the shading shows and the rule marks the bar. */}
          <div
            ref={wash}
            data-slot="current-bar"
            className="absolute top-0 left-0 border-b-2 border-ink bg-bar-current"
          />
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
                    ? 'absolute border-2 border-dashed border-score-loop-edge'
                    : 'absolute border-y-2 border-score-loop-edge bg-score-loop-fill'
                }
                style={boxStyle(bar)}
              />
            )
          })}
        </div>
        <div ref={host} className="relative z-10" />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
          {showUncertainty &&
            overlay.notes.map((note) =>
              note.level === 'high' && !note.timingFlagged ? null : (
                <NoteOutline key={note.noteId} note={note} />
              ),
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
          <div
            ref={cursor}
            data-slot="notation-cursor"
            className="absolute top-0 left-0 w-0.5 bg-score-playhead will-change-transform"
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
              style={boxStyle(bar)}
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

function boxStyle(box: { x: number; y: number; w: number; h: number }): CSSProperties {
  return { left: box.x, top: box.y, width: box.w, height: box.h }
}

function NoteOutline({ note }: { note: NoteBox }) {
  const pad = 2
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
        'absolute rounded-sm',
        note.level === 'medium' ? 'border-[1.5px] border-dashed border-conf-medium' : '',
        note.level === 'low' ? 'border-[1.5px] border-dashed border-conf-low' : '',
        note.timingFlagged && note.level === 'high'
          ? 'border-b-[1.5px] border-dotted border-ink'
          : '',
      ].join(' ')}
      style={style}
    >
      {note.level === 'low' && (
        <sup className="absolute -top-2 -right-2 text-xs leading-none font-bold text-conf-low">
          ?
        </sup>
      )}
    </span>
  )
}

// Page flips by staff system with at least the next bar in view; the continuous layout keeps
// the now-line a third of the way in.
function follow(
  element: HTMLElement | null,
  lookup: alphaTab.rendering.BoundsLookup,
  at: { index: number; x: number; y: number; h: number },
  layout: 'page' | 'scroll',
  smooth: boolean,
) {
  if (!element) return
  if (layout === 'scroll') {
    const left = Math.max(0, at.x - element.clientWidth / 3)
    if (Math.abs(element.scrollLeft - left) > 1) element.scrollLeft = left
    return
  }
  const system = lookup.staffSystems.find((s) => s.bars.some((b) => b.index === at.index))
  if (!system) return
  const top = element.scrollTop
  const bottom = top + element.clientHeight
  const lastOfSystem = system.bars.at(-1)?.index === at.index
  const next = lookup.staffSystems[system.index + 1]
  const needed = lastOfSystem && next ? next.realBounds.y + next.realBounds.h : at.y + at.h
  if (at.y < top || needed > bottom) {
    element.scrollTo({
      top: Math.max(0, at.y - LOOK_AHEAD_PX),
      behavior: smooth ? 'smooth' : 'auto',
    })
  }
}
