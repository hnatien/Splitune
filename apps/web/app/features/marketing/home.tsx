import { Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  type LucideIcon,
  MetronomeIcon,
  MoonStarIcon,
  TrendingUpIcon,
  WifiOffIcon,
} from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { buttonVariants } from '@/ui/button'
import { PedalIcon } from '@/ui/icons'
import {
  AlternativesStill,
  ChordStill,
  LegendStill,
  LoopStill,
  MixerStill,
  PassStill,
  ProductStill,
  TabStill,
  TimelineStill,
} from './product-still'

// Home (27 §3.1): the promise in one screen and the way to the example song, then the three proofs,
// what makes it work at the stand, how a session goes and the pricing teaser. The headline is the
// LCP element (budget ≤ 2.5 s, 10 §9), so it is plain text that never animates in.

const SECTION = 'mx-auto w-full max-w-page px-4 md:px-6 lg:px-8'

function Proof({
  index,
  eyebrow,
  title,
  body,
  points,
  flip = false,
  wide = false,
  children,
}: {
  index: number
  eyebrow: string
  title: string
  body: string
  points: string[]
  /** Picture first on wide screens, so the rows alternate. */
  flip?: boolean
  /** The picture needs the full width (the mixer rows): text above it, the points beside the text. */
  wide?: boolean
  children: React.ReactNode
}) {
  const list = (
    <ul className="mt-2 flex flex-col gap-3">
      {points.map((point) => (
        <li key={point} className="flex gap-3 text-base">
          <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          {point}
        </li>
      ))}
    </ul>
  )
  return (
    <section
      className={cn(
        'grid items-center gap-8',
        !wide && 'lg:gap-16',
        !wide && (flip ? 'lg:grid-cols-[3fr_2fr]' : 'lg:grid-cols-[2fr_3fr]'),
      )}
    >
      <div
        className={cn(
          'grid gap-4',
          flip && 'lg:order-2',
          wide && 'lg:grid-cols-2 lg:items-end lg:gap-x-16',
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <span className="tabular-nums">{String(index).padStart(2, '0')}</span>
            <span aria-hidden className="h-px w-8 bg-border" />
            {eyebrow}
          </p>
          <h2 className="text-3xl text-balance lg:text-4xl">{title}</h2>
          <p className="max-w-reading text-lg text-muted-foreground">{body}</p>
        </div>
        {list}
      </div>
      <div className="min-w-0 sm:rounded-3xl sm:bg-surface-sunken sm:p-6 lg:p-8">{children}</div>
    </section>
  )
}

const STAND: { icon: LucideIcon; title: () => string; body: () => string }[] = [
  {
    icon: MetronomeIcon,
    title: () => m['home.stand_beat_title'](),
    body: () => m['home.stand_beat_body'](),
  },
  {
    icon: PedalIcon,
    title: () => m['home.stand_pedal_title'](),
    body: () => m['home.stand_pedal_body'](),
  },
  {
    icon: EyeIcon,
    title: () => m['home.stand_read_title'](),
    body: () => m['home.stand_read_body'](),
  },
  {
    icon: MoonStarIcon,
    title: () => m['home.stand_stage_title'](),
    body: () => m['home.stand_stage_body'](),
  },
  {
    icon: WifiOffIcon,
    title: () => m['home.stand_offline_title'](),
    body: () => m['home.stand_offline_body'](),
  },
  {
    icon: TrendingUpIcon,
    title: () => m['home.stand_progress_title'](),
    body: () => m['home.stand_progress_body'](),
  },
]

export function Home() {
  const steps = [
    { title: m['home.step_1_title'](), body: m['home.step_1']() },
    { title: m['home.step_2_title'](), body: m['home.step_2']() },
    { title: m['home.step_3_title'](), body: m['home.step_3']() },
    { title: m['home.step_4_title'](), body: m['home.step_4']() },
  ]
  return (
    <div className="flex flex-col gap-24 pb-24 lg:gap-32 lg:pb-32">
      <section className={cn(SECTION, 'flex flex-col gap-12 pt-12 lg:gap-16 lg:pt-20')}>
        <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="primary">{m['home.badge']()}</Badge>
            <h1 className="max-w-[14ch] text-display text-balance">{m['home.headline']()}</h1>
          </div>
          <div className="flex flex-col gap-6">
            <p className="max-w-reading text-lg text-muted-foreground lg:text-xl lg:leading-8">
              {m['home.subhead']()}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/start"
                className={buttonVariants({ variant: 'primary', size: 'practice-2' })}
              >
                {m['home.cta_example']()}
                <ArrowRightIcon aria-hidden />
              </Link>
              <Link
                to="/auth/sign-in"
                className={buttonVariants({ variant: 'outline', size: 'practice-2' })}
              >
                {m['nav.sign_in']()}
              </Link>
            </div>
          </div>
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-x-0 top-1/4 -bottom-6 -z-10 rounded-3xl bg-surface-sunken"
          />
          <div className="px-0 sm:px-6 lg:px-12">
            <ProductStill caption={m['home.still_caption']()} />
          </div>
        </div>
      </section>

      <div className={cn(SECTION, 'flex flex-col gap-24 lg:gap-32')}>
        <Proof
          index={1}
          eyebrow={m['home.proof_isolate_eyebrow']()}
          title={m['home.proof_isolate_title']()}
          body={m['home.proof_isolate_body']()}
          points={[
            m['home.proof_isolate_point_1'](),
            m['home.proof_isolate_point_2'](),
            m['home.proof_isolate_point_3'](),
          ]}
          wide
        >
          <div className="rounded-2xl border border-border bg-card p-3 shadow-2 sm:p-5">
            <MixerStill />
          </div>
        </Proof>
        <Proof
          index={2}
          eyebrow={m['home.proof_loop_eyebrow']()}
          title={m['home.proof_loop_title']()}
          body={m['home.proof_loop_body']()}
          points={[
            m['home.proof_loop_point_1'](),
            m['home.proof_loop_point_2'](),
            m['home.proof_loop_point_3'](),
          ]}
          flip
        >
          <div
            inert
            aria-hidden
            data-density="practice"
            data-distance="desk"
            className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-2 sm:p-5"
          >
            <TimelineStill />
            <LoopStill />
            <PassStill />
          </div>
        </Proof>
        <Proof
          index={3}
          eyebrow={m['home.proof_honest_eyebrow']()}
          title={m['home.proof_honest_title']()}
          body={m['home.proof_honest_body']()}
          points={[
            m['home.proof_honest_point_1'](),
            m['home.proof_honest_point_2'](),
            m['home.proof_honest_point_3'](),
          ]}
        >
          <div
            inert
            aria-hidden
            data-density="practice"
            data-distance="desk"
            className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-2 sm:p-5"
          >
            <ChordStill />
            <TabStill bars={{ from: 7, to: 9 }} />
            <div className="grid gap-4 xl:grid-cols-[auto_1fr] xl:items-start">
              <AlternativesStill />
              <LegendStill />
            </div>
          </div>
        </Proof>
      </div>

      <section aria-labelledby="stand" className={cn(SECTION, 'flex flex-col gap-10')}>
        <div className="flex max-w-reading flex-col gap-3">
          <h2 id="stand" className="text-3xl text-balance lg:text-4xl">
            {m['home.stand_title']()}
          </h2>
          <p className="text-lg text-muted-foreground">{m['home.stand_intro']()}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAND.map(({ icon: Icon, title, body }) => (
            <li
              key={title()}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-6 shadow-1"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-muted text-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="text-lg">{title()}</h3>
              <p className="text-base text-muted-foreground">{body()}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="session" className={cn(SECTION, 'flex flex-col gap-10')}>
        <h2 id="session" className="text-3xl text-balance lg:text-4xl">
          {m['home.session_title']()}
        </h2>
        <ol className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 border-t-2 border-border pt-5">
              <span className="text-4xl text-muted-foreground tabular-nums">{i + 1}</span>
              <h3 className="text-lg">{step.title}</h3>
              <p className="text-base text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={SECTION}>
        <div className="grid items-center gap-8 rounded-3xl border border-border bg-surface-raised p-6 shadow-2 sm:p-10 lg:grid-cols-[1fr_auto] lg:p-14">
          <div className="flex max-w-reading flex-col gap-3">
            <h2 className="text-3xl text-balance lg:text-4xl">{m['home.pricing_title']()}</h2>
            <p className="text-lg text-muted-foreground">{m['home.pricing_body']()}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/start"
              className={buttonVariants({ variant: 'primary', size: 'practice-2' })}
            >
              {m['home.cta_example']()}
              <ArrowRightIcon aria-hidden />
            </Link>
            <Link
              to="/pricing"
              className={buttonVariants({ variant: 'outline', size: 'practice-2' })}
            >
              {m['home.pricing_link']()}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
