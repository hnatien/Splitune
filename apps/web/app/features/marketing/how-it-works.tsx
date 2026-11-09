import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { HowStage } from './how-scenes'

// How it works (27 §3.2): the pipeline in plain language, with an honest note on accuracy. An
// overview of the four steps links to each; every step pairs its text with a still picture of the
// app at that step, alternating sides on wide screens. The text carries the meaning; the pictures
// are inert and hidden from assistive tech, like Home's. Restyled on Night Rehearsal (s36): the
// step numbers in amber ink like Home's, pictures on cards, no scroll-driven motion.

const SECTION = 'mx-auto w-full max-w-marketing px-4 sm:px-6'

export function HowItWorks() {
  const steps = [
    {
      title: m['how.step_1_title'](),
      body: m['how.step_1_body'](),
      short: m['how.step_1_short'](),
    },
    {
      title: m['how.step_2_title'](),
      body: m['how.step_2_body'](),
      short: m['how.step_2_short'](),
    },
    {
      title: m['how.step_3_title'](),
      body: m['how.step_3_body'](),
      short: m['how.step_3_short'](),
    },
    {
      title: m['how.step_4_title'](),
      body: m['how.step_4_body'](),
      short: m['how.step_4_short'](),
    },
  ]
  return (
    <div className="flex flex-col gap-18 pb-18 lg:gap-24">
      <header className={cn(SECTION, 'flex flex-col gap-10 pt-14')}>
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl text-balance">{m['how.title']()}</h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">
            {m['how.intro']()}
          </p>
        </div>
        <nav aria-label={m['how.nav']()}>
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title}>
                <a
                  href={`#how-step-${i + 1}`}
                  className="flex min-h-target items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <span className="font-mono text-2xl font-semibold text-primary-ink tabular-nums">
                    {i + 1}
                  </span>
                  <span className="truncate text-lg font-semibold">{step.short}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <ol className={cn(SECTION, 'flex flex-col gap-18 lg:gap-24')}>
        {steps.map((step, i) => {
          const flip = i % 2 === 1
          return (
            <li
              key={step.title}
              id={`how-step-${i + 1}`}
              className={cn(
                'grid scroll-mt-24 items-center gap-8 lg:gap-16',
                flip ? 'lg:grid-cols-[3fr_2fr]' : 'lg:grid-cols-[2fr_3fr]',
              )}
            >
              <div className={cn('flex flex-col gap-4', flip && 'lg:order-2')}>
                <p className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                  <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden className="h-px w-8 bg-border" />
                  {step.short}
                </p>
                <h2 className="text-3xl text-balance">{step.title}</h2>
                <p className="max-w-reading text-lead text-muted-foreground">{step.body}</p>
              </div>
              <div className="min-w-0 sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-6 lg:p-8">
                <HowStage step={i} />
              </div>
            </li>
          )
        })}
      </ol>

      <section className={SECTION}>
        <div className="grid items-center gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-[1fr_auto]">
          <div className="flex max-w-reading flex-col gap-3">
            <h2 className="text-3xl text-balance">{m['how.accuracy_title']()}</h2>
            <p className="text-lead text-muted-foreground">{m['how.accuracy_body']()}</p>
          </div>
          <Link
            to="/start"
            className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'justify-self-start')}
          >
            {m['home.cta_example']()}
          </Link>
        </div>
      </section>
    </div>
  )
}
