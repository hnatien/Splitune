import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { HowStage } from './how-scenes'

// How it works (27 §3.2): the pipeline in plain language, with an honest note on accuracy. An
// overview of the four steps links to each; every step pairs its text with a still picture of the
// app at that step, alternating sides on wide screens. The text carries the meaning; the pictures
// are inert and hidden from assistive tech, like Home's.

const SECTION = 'mx-auto w-full max-w-page px-4 md:px-6 lg:px-8'

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
    <div className="flex flex-col gap-20 pb-24 lg:gap-28 lg:pb-32">
      <header className={cn(SECTION, 'flex flex-col gap-10 pt-12 lg:gap-14 lg:pt-20')}>
        <div className="flex flex-col gap-4">
          <h1 className="max-w-[14ch] text-display text-balance">{m['how.title']()}</h1>
          <p className="max-w-reading text-lg text-muted-foreground lg:text-xl lg:leading-8">
            {m['how.intro']()}
          </p>
        </div>
        <nav aria-label={m['how.nav']()}>
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title}>
                <a
                  href={`#how-step-${i + 1}`}
                  className="flex min-h-target items-center gap-3 rounded-2xl border border-border bg-surface-raised p-4 shadow-1 transition-colors hover:bg-muted"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="truncate text-lg font-semibold">{step.short}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <ol className={cn(SECTION, 'flex flex-col gap-20 lg:gap-28')}>
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
                <h2 className="text-3xl text-balance lg:text-4xl">{step.title}</h2>
                <p className="max-w-reading text-lg text-muted-foreground">{step.body}</p>
              </div>
              <div className="min-w-0 sm:rounded-3xl sm:bg-surface-sunken sm:p-6 lg:p-8">
                <HowStage step={i} />
              </div>
            </li>
          )
        })}
      </ol>

      <section className={SECTION}>
        <div className="grid items-center gap-8 rounded-3xl border border-border bg-surface-raised p-6 shadow-2 sm:p-10 lg:grid-cols-[1fr_auto] lg:p-14">
          <div className="flex max-w-reading flex-col gap-3">
            <h2 className="text-3xl text-balance lg:text-4xl">{m['how.accuracy_title']()}</h2>
            <p className="text-lg text-muted-foreground">{m['how.accuracy_body']()}</p>
          </div>
          <Link
            to="/start"
            className={cn(
              buttonVariants({ variant: 'primary', size: 'practice-2' }),
              'justify-self-start',
            )}
          >
            {m['home.cta_example']()}
            <ArrowRightIcon aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}
