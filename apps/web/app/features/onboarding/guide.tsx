import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { PlayIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { CoachMark } from '@/ui/coach-mark'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import { usePractice } from '../practice/practice-context'
import { usePracticeUi } from '../practice/practice-store'
import { examplesQuery } from './examples'
import { guestStore } from './guest-store'
import { type Answers, SongSummary, StepHeading, useStepViewed } from './song-parts'

// Onboarding steps 4–5 on a visitor's example song (27 §3.3, 13 §1), inside its practice screen
// (loaded by the practice route for ?guide): the song card over the screen while the part loads,
// so "Play your part" is the gesture that starts audio (HIG: no autoplay); then the suggested
// phrase loops at the starting speed with the part loud, with at most two coach marks that never
// cover the transport; after a completed pass, once playback has stopped, "Save your progress?"
// (never mid-pass).

const BUSY = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

const NO_ANSWERS: Answers = { instrument: null, level: null }

/**
 * Coach marks sit just above the timeline, where the loop band is drawn (the transport in Stage,
 * which hides the timeline): over the score, never over a control or the transport.
 */
function useAboveTimeline(): number | undefined {
  const [bottom, setBottom] = useState<number>()
  useLayoutEffect(() => {
    const place = () => {
      const anchor =
        document.querySelector('[data-slot=waveform-timeline]')?.parentElement ??
        document.querySelector('[data-slot=transport-bar]')
      if (anchor) setBottom(window.innerHeight - anchor.getBoundingClientRect().top + 8)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])
  return bottom
}

// The sign-in form loads with the first completed pass, not with the practice screen.
const SaveSheet = lazy(() =>
  import('./save-sheet').then((module) => ({ default: module.SaveSheet })),
)

export function OnboardingGuide() {
  const practice = usePractice()
  const { player, state, songId } = practice
  const navigate = useNavigate()
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
  const [phase, setPhase] = useState<'song' | 'loop'>('song')
  const [coach, setCoach] = useState<'loop' | 'pass' | 'done'>('loop')
  const [saveDismissed, setSaveDismissed] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const shownAt = useRef(performance.now())
  const bottom = useAboveTimeline()
  const promptPass = usePracticeUi((s) => s.promptPass)
  const ready = practice.audioStatus === 'ready' && player.loop !== null
  useStepViewed('song', known, answers !== undefined)
  useStepViewed('loop', known, answers !== undefined && phase === 'loop')
  useEffect(() => {
    if (example) analytics.track('example_song_opened', { example_id: example.id })
  }, [example])

  // Time to the isolated part (16 §2), from the song card to the music starting.
  const heard = useRef(false)
  useEffect(() => {
    if (phase !== 'loop' || heard.current || state !== 'playing') return
    heard.current = true
    analytics.track('first_isolated_playback', {
      ms_since_song_selected: Math.round(performance.now() - shownAt.current),
      source: 'example',
    })
  }, [phase, state])

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

  useEffect(() => {
    if (coach === 'loop' && promptPass > 0) setCoach('pass')
  }, [coach, promptPass])

  const offerSave = player.pass >= 1 && !BUSY.has(state)
  useEffect(() => {
    if (offerSave && !saveDismissed) setSaveOpen(true)
  }, [offerSave, saveDismissed])
  useStepViewed('save', known, answers !== undefined && saveOpen)

  const back = () =>
    void navigate({
      to: '/start',
      search: {
        step: 'screen',
        ...(known.instrument ? { instrument: known.instrument } : {}),
        ...(known.level ? { level: known.level } : {}),
      },
    })
  const bars = player.loop ? `${player.loop.startBar + 1}–${player.loop.endBar + 1}` : ''
  return (
    <>
      <Dialog open={phase === 'song'} onOpenChange={(open) => !open && back()}>
        <DialogContent>
          <DialogHeader>
            <StepHeading step={4} />
            <DialogTitle className="text-2xl">{m['start.song_title']()}</DialogTitle>
            <DialogDescription className="sr-only">{example?.title}</DialogDescription>
          </DialogHeader>
          {example && <SongSummary example={example} />}
          <Button
            variant="primary"
            size="practice"
            loading={!ready}
            disabled={!ready}
            onClick={() => {
              // The tap starts audio (iOS unlocks it inside the gesture).
              practice.togglePlay()
              setPhase('loop')
            }}
          >
            <PlayIcon aria-hidden />
            {ready ? m['start.play_part']() : m['start.song_loading']()}
          </Button>
          <Button variant="ghost" onClick={back}>
            {m['start.back']()}
          </Button>
        </DialogContent>
      </Dialog>
      {phase === 'loop' && (
        <div
          style={{ bottom }}
          className="pointer-events-none fixed inset-x-4 z-(--z-sticky) flex flex-col items-center gap-3 [&>*]:pointer-events-auto"
        >
          {coach === 'loop' && player.loop && (
            <CoachMark dismissLabel={m['start.got_it']()} onDismiss={() => setCoach('pass')}>
              {m['start.coach_loop']({ bars, speed: formatPercent(player.speedPct) })}
            </CoachMark>
          )}
          {coach === 'pass' && promptPass > 0 && (
            <CoachMark dismissLabel={m['start.got_it']()} onDismiss={() => setCoach('done')}>
              {m['start.coach_pass']()}
            </CoachMark>
          )}
          {saveDismissed && player.pass >= 1 && (
            <Button variant="outline" onClick={() => setSaveOpen(true)}>
              {m['start.save_progress']()}
            </Button>
          )}
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
