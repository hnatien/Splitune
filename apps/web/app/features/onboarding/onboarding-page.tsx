import type { Instrument, Level } from '@splitune/contracts'
import type { Distance } from '@splitune/ui-tokens'
import { ClientOnly, Link } from '@tanstack/react-router'
import { ChevronLeftIcon, DrumIcon, GuitarIcon, Music2Icon, PianoIcon } from 'lucide-react'
import type * as React from 'react'
import { lazy, Suspense, useEffect, useId, useRef } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { useDisplay } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { ChoiceCard } from '@/ui/choice-card'
import { BassIcon } from '@/ui/icons/bass'
import { DistanceIllustration } from '@/ui/icons/distance'
import { Label } from '@/ui/label'
import { RadioCard, RadioCardGroup } from '@/ui/radio-card'
import { Slider } from '@/ui/slider'
import { StepDots } from '@/ui/step-dots'
import { PracticeLoading } from '../practice/practice-loading'
import { PaletteLauncher } from '../shell/palette-launcher'
import { SkipLink } from '../shell/skip-link'
import { SystemBanners } from '../system/system-banners'
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

/**
 * The onboarding shell around one step (27 §1, §3.3, `Onboarding.dc.html`): a 64 px bar with Back,
 * the step dots and Skip, then the 1120 px column. Back leaves onboarding from step 1 (Home, or
 * the library when signed in); Skip goes to adding a song of one's own (27 §2), through creating
 * an account when signed out.
 */
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
  const back = (
    <>
      <ChevronLeftIcon aria-hidden />
      {m['start.back']()}
    </>
  )
  const ghost = buttonVariants({ variant: 'ghost', size: 'sm' })
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-background pt-[env(safe-area-inset-top)]">
        <div className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:px-5">
          <div className="justify-self-start">
            {onBack ? (
              <Button variant="ghost" size="sm" onClick={onBack}>
                {back}
              </Button>
            ) : (
              <Link to={signedIn ? '/library' : '/'} className={ghost}>
                {back}
              </Link>
            )}
          </div>
          <StepDots
            step={step}
            total={STEP_COUNT}
            text={m['start.step']({ step: String(step), total: String(STEP_COUNT) })}
            label={m['start.progress']()}
          />
          <div className="justify-self-end">
            {signedIn ? (
              <Link to="/library" search={{ add: 'file' }} className={ghost}>
                {m['start.skip']()}
              </Link>
            ) : (
              <Link to="/auth/sign-up" search={{ next: '/library?add=file' }} className={ghost}>
                {m['start.skip']()}
              </Link>
            )}
          </div>
        </div>
      </header>
      <SystemBanners />
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex w-full max-w-onboarding flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </div>
      </main>
      {signedIn && <PaletteLauncher />}
    </div>
  )
}

function InstrumentStep({ onPick }: { onPick: (instrument: InstrumentName) => void }) {
  const coming = m['start.instrument_coming']()
  return (
    <>
      <StepTitle>{m['start.instrument_title']()}</StepTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <StepTitle>{m['start.level_title']()}</StepTitle>
      <div className="grid gap-3 sm:grid-cols-3">
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

/** A step's display title (26 §6.2: `text-4xl`, 48 px). */
export function StepTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-4xl text-balance">{children}</h1>
}

// Chord names are notation, not copy: the same in every language.
const SAMPLE = ['Am', 'F'] as const

// "0 2 2 1 0" up the strings (an A minor shape), string 0 being the top line of six.
const SAMPLE_TAB = [
  { fret: '0', string: 4 },
  { fret: '2', string: 3 },
  { fret: '2', string: 2 },
  { fret: '1', string: 1 },
  { fret: '0', string: 0 },
] as const

// Tab string spacing follows the digit (26 §6.3: about 0.92 of the digit size).
const STRING_GAP_EM = 0.92

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

// Where's your screen? (27 §3.3, 26 §6.3): choosing a card applies its distance preset at once and
// the Reading size slider its calibration, so the sample is read at the size practice will use.
// "Skip for now" puts back what was there before.
function ScreenStep({ onDone }: { onDone: () => void }) {
  const distance = useDisplay((s) => s.distance)
  const calibration = useDisplay((s) => s.calibration)
  const update = useDisplay((s) => s.update)
  const before = useRef({ distance, calibration })
  const sampleId = useId()
  const sizeId = useId()
  return (
    <>
      <div className="flex max-w-160 flex-col gap-2.5">
        <StepTitle>{m['start.screen_title']()}</StepTitle>
        <p className="text-lead text-muted-foreground">{m['start.screen_hint']()}</p>
      </div>
      <RadioCardGroup
        value={distance ?? null}
        onValueChange={(value) => update({ distance: value as Distance })}
        aria-label={m['start.screen_title']()}
        className="gap-3.5 sm:grid-cols-3"
      >
        {DISTANCES.map((d) => (
          <RadioCard
            key={d.value}
            value={d.value}
            title={d.title()}
            description={d.hint()}
            media={<DistanceIllustration distance={d.value} />}
          />
        ))}
      </RadioCardGroup>
      <section
        aria-labelledby={sampleId}
        className="flex flex-wrap items-center gap-8 rounded-3xl border border-border bg-card p-6"
      >
        <div className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3">
          <h2 id={sampleId} className="text-lg">
            {m['start.read_title']()}
          </h2>
          <p className="text-sm text-muted-foreground">{m['start.read_hint']()}</p>
          <div className="flex max-w-90 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label id={sizeId}>{m['settings.calibration']()}</Label>
              <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                {formatPercent(calibration * 100)}
              </span>
            </div>
            <Slider
              aria-labelledby={sizeId}
              thumbLabels={[m['settings.calibration']()]}
              min={0.8}
              max={1.4}
              step={0.1}
              largeStep={0.2}
              value={calibration}
              onValueChange={(value) => update({ calibration: Number(value) })}
            />
          </div>
        </div>
        <ReadingSample />
      </section>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={onDone}>
          {m['start.continue']()}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            update(before.current)
            onDone()
          }}
        >
          {m['start.skip_for_now']()}
        </Button>
      </div>
    </>
  )
}

/**
 * The live sample (27 §3.3): chords at the chord-sheet size × 1.6 and a bar of tab at the tab
 * size, both following the distance preset and the Reading size as they change.
 */
function ReadingSample() {
  return (
    <div className="flex min-w-0 flex-[1_1_26rem] flex-wrap items-end justify-center gap-10 p-2.5">
      <div className="text-read-chord-sheet">
        <div className="flex gap-6.5 font-reading text-[1.6em] leading-none">
          {SAMPLE.map((chord) => (
            <span key={chord}>{chord}</span>
          ))}
        </div>
      </div>
      <span
        role="img"
        aria-label={m['start.sample_tab']()}
        className="relative block h-[4.6em] w-[min(9em,100%)] font-mono text-read-tab tabular-nums"
      >
        {Array.from({ length: 6 }, (_, line) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the six string lines never reorder
            key={line}
            className="absolute inset-x-0 h-px bg-staff"
            style={{ top: `${line * STRING_GAP_EM}em` }}
          />
        ))}
        {SAMPLE_TAB.map((note, i) => (
          <span
            key={note.string}
            className="absolute -translate-1/2 rounded-sm bg-card px-0.75 leading-none"
            style={{ left: `${12 + i * 20}%`, top: `${note.string * STRING_GAP_EM}em` }}
          >
            {note.fret}
          </span>
        ))}
      </span>
    </div>
  )
}
