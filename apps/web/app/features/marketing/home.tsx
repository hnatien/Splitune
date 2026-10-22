import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { ChordStill, LegendStill, LoopStill, ProductStill, StemStill } from './product-still'

// Home (27 §3.1): the promise in one screen and the way to the example song. The headline is the
// LCP element (budget ≤ 2.5 s, 10 §9), so it is plain text with no web-font dependency on layout.

function Proof({
  title,
  body,
  wide = false,
  children,
}: {
  title: string
  body: string
  /** The still needs the full width (the mixer row). */
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={wide ? 'grid gap-6' : 'grid items-center gap-6 md:grid-cols-2'}>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl">{title}</h2>
        <p className="text-base text-muted-foreground">{body}</p>
      </div>
      {/* Pictures of the app: Desk reading sizes on every device (a phone's Floor sizes overflowed),
          cropped rather than widening the page at 320 px; the text beside them says what they show. */}
      <div
        inert
        aria-hidden
        data-density="practice"
        data-distance="desk"
        className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-5"
      >
        {children}
      </div>
    </section>
  )
}

export function Home() {
  const steps = [m['home.step_1'](), m['home.step_2'](), m['home.step_3'](), m['home.step_4']()]
  return (
    <div className="mx-auto flex max-w-page flex-col gap-16 px-4 py-12 md:px-6 lg:px-8 lg:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <h1 className="text-4xl text-balance lg:text-[clamp(2rem,1.4rem+2.4vw,3.5rem)] lg:leading-tight">
            {m['home.headline']()}
          </h1>
          <p className="max-w-reading text-lg text-muted-foreground">{m['home.subhead']()}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/start" className={buttonVariants({ variant: 'primary' })}>
              {m['home.cta_example']()}
            </Link>
            <Link to="/auth/sign-in" className={buttonVariants({ variant: 'outline' })}>
              {m['nav.sign_in']()}
            </Link>
          </div>
        </div>
        <ProductStill caption={m['home.still_caption']()} />
      </section>

      <div className="flex flex-col gap-12">
        <Proof title={m['home.proof_isolate_title']()} body={m['home.proof_isolate_body']()} wide>
          <StemStill />
        </Proof>
        <Proof title={m['home.proof_loop_title']()} body={m['home.proof_loop_body']()}>
          <LoopStill />
        </Proof>
        <Proof title={m['home.proof_honest_title']()} body={m['home.proof_honest_body']()}>
          <div className="flex flex-col gap-4">
            <ChordStill />
            <LegendStill />
          </div>
        </Proof>
      </div>

      <section aria-labelledby="session" className="flex flex-col gap-6">
        <h2 id="session" className="text-xl">
          {m['home.session_title']()}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="text-base">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl">{m['home.pricing_title']()}</h2>
        <p className="max-w-reading text-base text-muted-foreground">{m['home.pricing_body']()}</p>
        <Link to="/pricing" className={buttonVariants({ variant: 'outline' })}>
          {m['home.pricing_link']()}
        </Link>
      </section>
    </div>
  )
}
