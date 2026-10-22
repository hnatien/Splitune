import type { Instrument, Level } from '@splitune/contracts'
import type { Distance } from '@splitune/ui-tokens'
import { ClientOnly } from '@tanstack/react-router'
import { ChevronLeftIcon, DrumIcon, GuitarIcon, Music2Icon, PianoIcon } from 'lucide-react'
import type * as React from 'react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { ChoiceCard } from '@/ui/choice-card'
import { BassIcon } from '@/ui/icons/bass'
import { RadioCard, RadioCardGroup } from '@/ui/radio-card'
import { StepDots } from '@/ui/step-dots'
import { PracticeLoading } from '../practice/practice-loading'
import { FocusShell } from '../shell/focus-shell'
import { STEP_COUNT } from './song-parts'

// Onboarding /start (27 §3.3, 13 §1): instrument → level → where's your screen (skippable) → the
// example song, played with the part loud and looped at the starting speed. The answers live in
// the URL (Back and reload keep them) and on the device for the claim at sign-in.

type InstrumentName = z.infer<typeof Instrument>
type LevelName = z.infer<typeof Level>

export type StartStep = 'instrument' | 'level' | 'screen' | 'song'
export interface StartSearch {
  step?: StartStep | undefined
  instrument?: InstrumentName | undefined
  level?: LevelName | undefined
}

const STEP_NUMBER: Record<StartStep, number> = { instrument: 1, level: 2, screen: 3, song: 4 }

// The song step resolves the example (and claims it for a signed-in learner) on demand.
const FirstSong = lazy(() =>
  import('./first-song').then((module) => ({ default: module.FirstSong })),
)

export function OnboardingPage({
  search,
  signedIn,
  go,
}: {
  search: StartSearch
  signedIn: boolean
  go: (search: StartSearch) => void
}) {
  const step = search.step ?? 'instrument'
  const { instrument = null, level = null } = search
  useEffect(() => {
    if (step === 'song') return // the song step reports itself once the song is known
    analytics.track('onboarding_step_viewed', { step, instrument, level })
  }, [step, instrument, level])

  if (step === 'song') {
    return (
      <ClientOnly fallback={<PracticeLoading />}>
        <Suspense fallback={<PracticeLoading />}>
          <FirstSong
            instrument={instrument}
            level={level}
            signedIn={signedIn}
            onBack={() => go({ ...search, step: 'screen' })}
          />
        </Suspense>
      </ClientOnly>
    )
  }
  const back =
    step === 'level'
      ? () => go({ step: 'instrument' })
      : step === 'screen'
        ? () => go({ ...search, step: 'level' })
        : undefined
  return (
    <StepFrame step={STEP_NUMBER[step]} signedIn={signedIn} onBack={back}>
      {step === 'instrument' && (
        <InstrumentStep onPick={(picked) => go({ step: 'level', instrument: picked })} />
      )}
      {step === 'level' && (
        <LevelStep onPick={(picked) => go({ ...search, step: 'screen', level: picked })} />
      )}
      {step === 'screen' && <ScreenStep onDone={() => go({ ...search, step: 'song' })} />}
    </StepFrame>
  )
}

/** The focus shell around one onboarding step: progress dots, Back and the step's content. */
export function StepFrame({
  step,
  signedIn,
  onBack,
  children,
}: {
  step: number
  signedIn: boolean
  onBack?: (() => void) | undefined
  children: React.ReactNode
}) {
  return (
    <FocusShell exit={!signedIn}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex min-h-control items-center justify-between gap-3">
          <StepDots
            step={step}
            total={STEP_COUNT}
            text={m['start.step']({ step: String(step), total: String(STEP_COUNT) })}
            label={m['start.progress']()}
          />
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              <ChevronLeftIcon aria-hidden />
              {m['start.back']()}
            </Button>
          )}
        </div>
        {children}
      </div>
    </FocusShell>
  )
}

function InstrumentStep({ onPick }: { onPick: (instrument: InstrumentName) => void }) {
  const coming = m['start.instrument_coming']()
  return (
    <>
      <h1 className="text-2xl">{m['start.instrument_title']()}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          icon={<GuitarIcon />}
          title={m['instrument.guitar']()}
          onClick={() => onPick('guitar')}
        />
        <ChoiceCard
          icon={<BassIcon />}
          title={m['instrument.bass']()}
          onClick={() => onPick('bass')}
        />
        <ChoiceCard
          icon={<PianoIcon />}
          title={m['instrument.piano']()}
          description={coming}
          unavailable
        />
        <ChoiceCard
          icon={<DrumIcon />}
          title={m['instrument.drums']()}
          description={coming}
          unavailable
        />
        <ChoiceCard
          icon={<Music2Icon />}
          title={m['instrument.other']()}
          onClick={() => onPick('other')}
        />
      </div>
    </>
  )
}

function LevelStep({ onPick }: { onPick: (level: LevelName) => void }) {
  return (
    <>
      <h1 className="text-2xl">{m['start.level_title']()}</h1>
      <div className="flex flex-col gap-3">
        <ChoiceCard
          title={m['settings.level_just_started']()}
          onClick={() => onPick('just_started')}
        />
        <ChoiceCard title={m['settings.level_few_songs']()} onClick={() => onPick('few_songs')} />
        <ChoiceCard title={m['settings.level_returning']()} onClick={() => onPick('returning')} />
      </div>
    </>
  )
}

// Chord names are notation, not copy: the same in every language.
const SAMPLE = ['Am', 'F'] as const

const DISTANCES: { value: Distance; title: () => string; hint: () => string }[] = [
  {
    value: 'desk',
    title: () => m['settings.distance_desk'](),
    hint: () => m['start.screen_desk_hint'](),
  },
  {
    value: 'stand',
    title: () => m['settings.distance_stand'](),
    hint: () => m['start.screen_stand_hint'](),
  },
  {
    value: 'floor',
    title: () => m['settings.distance_floor'](),
    hint: () => m['start.screen_floor_hint'](),
  },
]

// Where's your screen? (26 §6.3): choosing applies the distance preset at once, so the sample
// below is read at the real size; Skip keeps what was there before.
function ScreenStep({ onDone }: { onDone: () => void }) {
  const distance = useDisplay((s) => s.distance)
  const update = useDisplay((s) => s.update)
  const before = useRef(distance)
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{m['start.screen_title']()}</h1>
        <p className="text-base text-muted-foreground">{m['start.screen_hint']()}</p>
      </div>
      <RadioCardGroup
        value={distance ?? null}
        onValueChange={(value) => update({ distance: value as Distance })}
        aria-label={m['start.screen_title']()}
        className="sm:grid-cols-3"
      >
        {DISTANCES.map((d) => (
          <RadioCard key={d.value} value={d.value} title={d.title()} description={d.hint()} />
        ))}
      </RadioCardGroup>
      <section
        aria-labelledby="readable"
        className="flex flex-col gap-3 rounded-xl border border-border bg-paper p-4 text-ink"
      >
        <h2 id="readable" className="text-base font-semibold">
          {m['start.can_you_read']()}
        </h2>
        <div className="flex flex-wrap items-baseline gap-6">
          <span className="font-reading text-read-chord-current font-semibold">{SAMPLE[0]}</span>
          <span className="font-reading text-read-chord">{SAMPLE[1]}</span>
          <span
            role="img"
            aria-label={m['start.sample_tab']()}
            className="font-reading text-read-tab font-semibold tabular-nums"
          >
            0 2 2 1 0
          </span>
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="practice-2" onClick={onDone}>
          {m['start.continue']()}
        </Button>
        <Button
          variant="ghost"
          size="practice-2"
          onClick={() => {
            update({ distance: before.current })
            onDone()
          }}
        >
          {m['start.skip']()}
        </Button>
      </div>
    </>
  )
}
