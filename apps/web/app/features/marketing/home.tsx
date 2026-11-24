import { Link } from '@tanstack/react-router'
import { CloudOffIcon, type LucideIcon, TrendingUpIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { CountInIcon, DistanceStandIcon, TwoPedalsIcon } from '@/ui/icons'
import { PracticeStill } from './practice-still'

// Home (27 §3.1, s47 direction §1): the product is the hero. The promise and its one primary
// action, then the practice screen itself, drawn from the kit (the tab with its chords and unsure
// marks, the loop, the speed, the mix), with what it does as three captions under it. Then what
// makes it work at the stand, how a session goes, and the pricing teaser, as hairline lists rather
// than boxes. Signed-in visitors get the way back to their library instead of the guest pitch. The
// headline is the LCP element (budget ≤ 2.5 s, 10 §9), so it is plain text that never animates in.
// Honesty gates (27 §3.1): no claim of a step that hasn't shipped (Stand view, the speed ladder,
// beat lights, a fader for every stem).

const GRID = 'mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8'

/** The headline's sentences, so each can hold its own line. */
const sentences = (text: string) => text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text]

const STAND: { icon: LucideIcon | React.ComponentType; title: () => string; body: () => string }[] =
  [
    {
      icon: TwoPedalsIcon,
      title: () => m['home.stand_pedal_title'](),
      body: () => m['home.stand_pedal_body'](),
    },
    {
      icon: DistanceStandIcon,
      title: () => m['home.stand_read_title'](),
      body: () => m['home.stand_read_body'](),
    },
    {
      icon: CountInIcon,
      title: () => m['home.stand_beat_title'](),
      body: () => m['home.stand_beat_body'](),
    },
    {
      icon: CloudOffIcon,
      title: () => m['home.stand_offline_title'](),
      body: () => m['home.stand_offline_body'](),
    },
    {
      icon: TrendingUpIcon,
      title: () => m['home.stand_progress_title'](),
      body: () => m['home.stand_progress_body'](),
    },
  ]

export function Home({ signedIn }: { signedIn: boolean }) {
  const proofs = [
    { title: m['home.proof_isolate_title'](), body: m['home.proof_isolate_body']() },
    { title: m['home.proof_loop_title'](), body: m['home.proof_loop_body']() },
    { title: m['home.proof_honest_title'](), body: m['home.proof_honest_body']() },
  ]
  const steps = [
    { title: m['home.step_1_title'](), body: m['home.step_1']() },
    { title: m['home.step_2_title'](), body: m['home.step_2']() },
    { title: m['home.step_3_title'](), body: m['home.step_3']() },
    { title: m['home.step_4_title'](), body: m['home.step_4']() },
  ]
  return (
    <div className="flex flex-col gap-24 pb-24 sm:gap-32">
      <section aria-labelledby="home-title" className={cn(GRID, 'flex flex-col gap-12 pt-12')}>
        <div className="flex max-w-3xl flex-col items-start gap-5 sm:pt-8">
          <h1 id="home-title" className="text-hero">
            {sentences(m['home.headline']()).map((sentence) => (
              <span key={sentence} className="block text-balance">
                {sentence}{' '}
              </span>
            ))}
          </h1>
          <p className="max-w-[58ch] text-lead text-pretty text-muted-foreground">
            {m['home.subhead']()}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
            {signedIn ? (
              <Link to="/library" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                {m['home.cta_library']()}
              </Link>
            ) : (
              <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                {m['home.cta_example']()}
              </Link>
            )}
            <p className="text-body-sm text-pretty text-muted-foreground">
              {signedIn ? m['home.note']() : `${m['home.badge']()} · ${m['home.note']()}`}
            </p>
          </div>
        </div>
        <PracticeStill />
        <ul aria-label={m['home.does_label']()} className="grid gap-x-8 gap-y-8 md:grid-cols-3">
          {proofs.map((proof) => (
            <li key={proof.title} className="flex flex-col gap-2 border-t border-border pt-5">
              <h2 className="text-title text-balance">{proof.title}</h2>
              <p className="text-body text-pretty text-muted-foreground">{proof.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stand" className={cn(GRID, 'flex flex-col gap-8')}>
        <h2 id="stand" className="text-display text-balance">
          {m['home.stand_title']()}
        </h2>
        <ul className="grid gap-x-12 md:grid-cols-2">
          {STAND.map(({ icon: Icon, title, body }) => (
            <li key={title()} className="flex gap-4 border-t border-border py-5">
              <Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <h3 className="text-title text-balance">{title()}</h3>
                <p className="text-body text-pretty text-muted-foreground">{body()}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="session" className={cn(GRID, 'flex flex-col gap-8')}>
        <h2 id="session" className="text-display text-balance">
          {m['home.session_title']()}
        </h2>
        <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 border-t border-border pt-5">
              <span aria-hidden className="text-body-sm text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <h3 className="text-title text-balance">{step.title}</h3>
              <p className="text-body text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="free" className={GRID}>
        <div className="flex flex-col items-start gap-5 border-t border-border pt-16">
          <h2 id="free" className="max-w-[18ch] text-display text-balance">
            {m['home.pricing_title']()}
          </h2>
          <p className="max-w-[48ch] text-lead text-pretty text-muted-foreground">
            {m['home.pricing_body']()}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {!signedIn && (
              <Link to="/start" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                {m['home.cta_example']()}
              </Link>
            )}
            <Link
              to="/pricing"
              className={buttonVariants({ variant: signedIn ? 'outline' : 'quiet', size: 'lg' })}
            >
              {m['home.pricing_link']()}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
