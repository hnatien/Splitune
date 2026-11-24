import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LightbulbIcon } from 'lucide-react'
import type * as React from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { usePractice } from '../practice/practice-context'
import { usePracticeUi } from '../practice/practice-store'
import { examplesQuery } from './examples'
import { guestStore } from './guest-store'
import { type Answers, partOf, useStepViewed } from './song-parts'

// The guide on a visitor's example song (27 §3.3, 13 §1, s47 direction), inside its practice
// screen (loaded by the practice route for ?guide). One quiet line at a time, in the page's flow
// above the song map, so it never covers the music, the transport or a control: first what will
// play and that Play (or Space) starts it (no autoplay); once playing, the loop it set; after a
// pass, how to mark it. Each line goes with "Got it" or Escape and does not come back. After a
// completed pass, once playback has stopped, "Save your progress?" (never mid-pass); dismissed, it
// stays one line away.

const BUSY = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

const NO_ANSWERS: Answers = { instrument: null, level: null }

type Line = 'start' | 'loop' | 'pass' | 'save'

/** Back to the focus sink (12 §8), so the practice keys and the pedal keep working. */
function refocusPage() {
  document.getElementById('main')?.focus({ preventScroll: true })
}

// The sign-in form loads with the first completed pass, not with the practice screen.
const SaveSheet = lazy(() =>
  import('./save-sheet').then((module) => ({ default: module.SaveSheet })),
)

export function OnboardingGuide() {
  const practice = usePractice()
  const { player, state, songId } = practice
  const examples = useQuery(examplesQuery)
  const example = examples.data?.items.find((e) => e.song.id === songId)
  // The visitor's onboarding answers (for the funnel events and the way back); events wait for them.
  const [answers, setAnswers] = useState<(Answers & { landedAt: number }) | undefined>()
  useEffect(() => {
    void guestStore
      .all('profile')
      .then(([profile]) =>
        setAnswers(profile ?? { instrument: null, level: null, landedAt: Date.now() }),
      )
  }, [])
  const known = answers ?? NO_ANSWERS
  const [played, setPlayed] = useState(false)
  const [dismissed, setDismissed] = useState<ReadonlySet<Line>>(new Set())
  const [saveDismissed, setSaveDismissed] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const shownAt = useRef(performance.now())
  const promptPass = usePracticeUi((s) => s.promptPass)
  const ready = practice.audioStatus === 'ready' && player.loop !== null
  useStepViewed('song', known, answers !== undefined)
  useStepViewed('loop', known, answers !== undefined && played)
  useEffect(() => {
    if (example) analytics.track('example_song_opened', { example_id: example.id })
  }, [example])

  useEffect(() => {
    if (state === 'countIn' || state === 'playing') setPlayed(true)
  }, [state])

  // Time to the isolated part (16 §2), from the practice screen opening to the music starting.
  const heard = useRef(false)
  useEffect(() => {
    if (heard.current || state !== 'playing') return
    heard.current = true
    analytics.track('first_isolated_playback', {
      ms_since_song_selected: Math.round(performance.now() - shownAt.current),
      source: 'example',
    })
  }, [state])

  // Time to the first slowed loop (16 §2), from landing on /start to the first full pass.
  const looped = useRef(false)
  useEffect(() => {
    if (looped.current || !answers || player.pass < 1 || player.speedPct >= 100) return
    looped.current = true
    analytics.track('first_loop_reduced_speed', {
      ms_since_landing: Math.max(0, Date.now() - answers.landedAt),
      tempo_pct: player.speedPct,
    })
  }, [player.pass, player.speedPct, answers])

  const offerSave = player.pass >= 1 && !BUSY.has(state)
  useEffect(() => {
    if (offerSave && !saveDismissed) setSaveOpen(true)
  }, [offerSave, saveDismissed])
  useStepViewed('save', known, answers !== undefined && saveOpen)

  const line: Line | null = !played
    ? dismissed.has('start')
      ? null
      : 'start'
    : promptPass > 0 && !dismissed.has('pass')
      ? 'pass'
      : saveDismissed && player.pass >= 1 && !dismissed.has('save')
        ? 'save'
        : promptPass === 0 && player.pass < 1 && player.loop && !dismissed.has('loop')
          ? 'loop'
          : null

  const box = useRef<HTMLDivElement>(null)
  const dismiss = (which: Line) => {
    setDismissed((before) => new Set(before).add(which))
    refocusPage()
  }
  // Escape dismisses the line from the page itself, never from a field, a menu or a panel.
  useEffect(() => {
    if (!line) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target
      const onPage =
        target === document.body ||
        (target instanceof HTMLElement && target.id === 'main') ||
        (target instanceof Node && Boolean(box.current?.contains(target)))
      if (!onPage) return
      setDismissed((before) => new Set(before).add(line))
      refocusPage()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [line])

  const bars = player.loop
    ? `${player.loop.startBar + 1}–${player.loop.endBar + 1}`
    : example
      ? `${example.loop.start_bar + 1}–${example.loop.end_bar + 1}`
      : ''
  const speed = formatPercent(player.speedPct)
  const gotIt = (which: Line) => (
    <Button variant="quiet" size="sm" shortcut="Esc" onClick={() => dismiss(which)}>
      {m['start.got_it']()}
    </Button>
  )

  let content: { title: string; actions: React.ReactNode } | null = null
  if (line === 'start') {
    content = {
      title:
        ready && example
          ? m['start.guide_start']({ title: example.title, part: partOf(example), bars, speed })
          : m['start.song_loading'](),
      actions: (
        <>
          <Link
            to="/start"
            search={{
              ...(known.instrument ? { instrument: known.instrument } : {}),
              ...(known.level ? { level: known.level } : {}),
              ...(example ? { song: example.id } : {}),
            }}
            // On phones Back and Exit lead there too; the line keeps to one action.
            className={buttonVariants({ variant: 'quiet', size: 'sm', className: 'max-sm:hidden' })}
          >
            {m['start.change_song']()}
          </Link>
          {gotIt('start')}
        </>
      ),
    }
  } else if (line === 'loop') {
    content = { title: m['start.coach_loop']({ bars, speed }), actions: gotIt('loop') }
  } else if (line === 'pass') {
    content = { title: m['start.coach_pass'](), actions: gotIt('pass') }
  } else if (line === 'save') {
    content = {
      title: m['start.saved_here'](),
      actions: (
        <>
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
            {m['start.save_progress']()}
          </Button>
          {gotIt('save')}
        </>
      ),
    }
  }

  return (
    <>
      {content && (
        <div
          ref={box}
          role="status"
          data-slot="onboarding-guide"
          // First in the practice page's column, above the song map: it takes its own room. The
          // actions never wrap under the words, so on a phone the line stays as short as it can.
          className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-1 sm:px-4"
        >
          <LightbulbIcon
            aria-hidden
            strokeWidth={1.8}
            className="size-4.5 shrink-0 text-muted-foreground"
          />
          <p className="min-w-0 flex-1 py-2 text-body-sm text-foreground">{content.title}</p>
          <div className="flex shrink-0 items-center gap-1">{content.actions}</div>
        </div>
      )}
      {player.pass >= 1 && (
        <Suspense fallback={null}>
          <SaveSheet
            open={saveOpen}
            onClose={() => {
              setSaveOpen(false)
              setSaveDismissed(true)
            }}
          />
        </Suspense>
      )}
    </>
  )
}
