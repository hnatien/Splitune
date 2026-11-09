import { Link } from '@tanstack/react-router'
import {
  ALargeSmallIcon,
  DownloadIcon,
  type LucideIcon,
  TimerIcon,
  TrendingUpIcon,
} from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { buttonVariants } from '@/ui/button'
import { Card } from '@/ui/card'
import { PedalIcon } from '@/ui/icons'
import { HeroStill, LoopStill, StemLevelsStill, Still, UnsureStill } from './product-still'

// Home (27 §3.1, `Home.dc.html`): the promise in one screen and the way to the example song, what
// it does, what makes it work at the stand, how a session goes and the pricing teaser. The headline
// is the LCP element (budget ≤ 2.5 s, 10 §9), so it is plain text that never animates in.
// Honesty gates (27 §3.1): claims of unbuilt steps keep today's wording until s45 flips them — the
// isolate body (s40b), the loop body (s37), the count-in body (s42) — and "Stand view for tablets"
// (s43) is left out of the stand list until then.

const SECTION = 'mx-auto w-full max-w-marketing px-4 sm:px-6'

function Proof({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {children}
      <h2 className="text-xl">{title}</h2>
      <p className="text-base text-muted-foreground">{body}</p>
    </div>
  )
}

const STAND: { icon: LucideIcon; title: () => string; body: () => string }[] = [
  {
    icon: PedalIcon,
    title: () => m['home.stand_pedal_title'](),
    body: () => m['home.stand_pedal_body'](),
  },
  {
    icon: ALargeSmallIcon,
    title: () => m['home.stand_read_title'](),
    body: () => m['home.stand_read_body'](),
  },
  {
    icon: TimerIcon,
    title: () => m['home.stand_beat_title'](),
    body: () => m['home.stand_beat_body'](),
  },
  {
    icon: DownloadIcon,
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
    <div className="flex flex-col">
      <section
        aria-labelledby="home-title"
        className={cn(SECTION, 'flex flex-wrap items-center gap-14 pt-14 pb-18')}
      >
        <div className="flex min-w-0 flex-[1_1_28rem] flex-col items-start gap-6">
          <Badge variant="primary" className="h-7 px-3">
            {m['home.badge']()}
          </Badge>
          <h1 id="home-title" className="text-display text-balance">
            {m['home.headline']()}
          </h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">
            {m['home.subhead']()}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'xl' })}>
              {m['home.cta_example']()}
            </Link>
            <Link to="/auth/sign-in" className={buttonVariants({ size: 'xl' })}>
              {m['nav.sign_in']()}
            </Link>
          </div>
          <p className="text-sm text-faint-foreground">{m['home.note']()}</p>
        </div>
        <div className="min-w-0 flex-[1_1_32rem]">
          <HeroStill label={m['home.still_label']()} />
        </div>
      </section>

      <section aria-label={m['home.does_label']()} className="border-y border-border bg-card">
        <div
          className={cn(
            SECTION,
            'grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] gap-10 py-16',
          )}
        >
          <Proof title={m['home.proof_isolate_title']()} body={m['home.proof_isolate_body']()}>
            <StemLevelsStill />
          </Proof>
          <Proof title={m['home.proof_loop_title']()} body={m['home.proof_loop_body']()}>
            <Still className="rounded-3xl border border-border bg-background p-3.5">
              <LoopStill />
            </Still>
          </Proof>
          <Proof title={m['home.proof_honest_title']()} body={m['home.proof_honest_body']()}>
            <UnsureStill />
          </Proof>
        </div>
      </section>

      <section aria-labelledby="stand" className={cn(SECTION, 'flex flex-col gap-8 py-18')}>
        <h2 id="stand" className="text-3xl text-balance">
          {m['home.stand_title']()}
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(21rem,100%),1fr))] gap-x-10 gap-y-7">
          {STAND.map(({ icon: Icon, title, body }) => (
            <li key={title()} className="flex gap-3.5">
              <Icon aria-hidden strokeWidth={1.8} className="size-6 shrink-0 text-foreground" />
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg">{title()}</h3>
                <p className="text-base text-muted-foreground">{body()}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="session" className="border-t border-border bg-card">
        <div className={cn(SECTION, 'flex flex-col gap-8 py-18')}>
          <h2 id="session" className="text-3xl text-balance">
            {m['home.session_title']()}
          </h2>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-5">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Card className="flex h-full flex-col gap-2.5 bg-background p-5">
                  <span className="font-mono text-2xl font-semibold text-primary-ink tabular-nums">
                    {i + 1}
                  </span>
                  <h3 className="text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="free"
        className={cn(SECTION, 'flex flex-wrap items-center gap-6 py-18')}
      >
        <div className="flex flex-[1_1_26rem] flex-col gap-2.5">
          <h2 id="free" className="text-3xl text-balance">
            {m['home.pricing_title']()}
          </h2>
          <p className="text-base text-muted-foreground">{m['home.pricing_body']()}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {m['home.cta_example']()}
          </Link>
          <Link to="/pricing" className={buttonVariants({ size: 'lg' })}>
            {m['home.pricing_link']()}
          </Link>
        </div>
      </section>
    </div>
  )
}
