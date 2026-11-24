import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { HowStage } from './how-scenes'
import { useCurrentSection } from './use-current-section'

// How it works (27 §3.2): the pipeline in plain language, with an honest note on accuracy. The
// title, then the four steps as links that mark the step being read with the ink edge
// (aria-current) as the page scrolls, held under the bar so the mark stays in view (one row,
// scrolling sideways on phones); each step is its own section, the text on the left and a
// picture of the app at that step beside it on wide screens (under it on narrow ones). Each
// picture is one image with a text alternative. The page's one primary is the example song at
// the end. No scroll-driven motion.

const GRID = 'mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8'

const stepId = (index: number) => `how-step-${index + 1}`

export function HowItWorks({ signedIn = false }: { signedIn?: boolean }) {
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
  const current = useCurrentSection(steps.map((_, i) => stepId(i)))
  // Where the row scrolls sideways (phones), the marked step is kept in it.
  const row = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = row.current
    const mark = list?.querySelector<HTMLElement>('[aria-current=step]')
    if (!list || !mark || current === undefined) return
    const start = mark.offsetLeft - list.offsetLeft
    if (start < list.scrollLeft || start + mark.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = start - (list.clientWidth - mark.offsetWidth) / 2
    }
  }, [current])
  return (
    <div className="flex flex-col pb-24">
      <header className={cn(GRID, 'flex flex-col items-start gap-4 pt-12 sm:pt-20')}>
        <h1 className="max-w-3xl text-display text-balance">{m['how.title']()}</h1>
        <p className="max-w-3xl text-lead text-pretty text-muted-foreground">{m['how.intro']()}</p>
      </header>
      {/* Under the marketing bar (min-h-16); the steps' scroll margin and the page's scroll
          padding clear both. */}
      <nav
        aria-label={m['how.nav']()}
        className="sticky top-16 z-(--z-sticky) mt-8 border-b border-border bg-background"
      >
        <div className={cn(GRID, 'py-2')}>
          <ol ref={row} className="-mx-1 flex gap-1 overflow-x-auto px-1 py-1">
            {steps.map((step, i) => {
              const here = current === stepId(i)
              return (
                <li key={step.title} className="shrink-0">
                  <a
                    href={`#${stepId(i)}`}
                    aria-current={here ? 'step' : undefined}
                    className={buttonVariants({ variant: here ? 'selected' : 'quiet' })}
                  >
                    <span aria-hidden className="text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    {step.short}
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      </nav>

      <ol className={cn(GRID, 'flex flex-col')}>
        {steps.map((step, i) => (
          <li
            key={step.title}
            id={stepId(i)}
            className="grid scroll-mt-18 items-start gap-8 border-b border-border py-16 last:border-b-0 sm:py-20 lg:grid-cols-[1fr_2fr] lg:gap-16"
          >
            <div className="flex flex-col gap-3 lg:pt-4">
              <span className="text-body-sm text-muted-foreground tabular-nums">
                {m['how.step_number']({ step: String(i + 1), total: String(steps.length) })}
              </span>
              <h2 className="text-heading text-balance">{step.title}</h2>
              <p className="max-w-reading text-lead text-pretty text-muted-foreground">
                {step.body}
              </p>
            </div>
            <HowStage step={i} />
          </li>
        ))}
      </ol>

      <section className={cn(GRID, 'flex flex-col items-start gap-6 pt-8')}>
        <div className="flex max-w-reading flex-col gap-3 border-t border-border pt-16">
          <h2 className="text-display text-balance">{m['how.accuracy_title']()}</h2>
          <p className="text-lead text-pretty text-muted-foreground">{m['how.accuracy_body']()}</p>
        </div>
        {signedIn ? (
          <Link to="/library" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {m['home.cta_library']()}
          </Link>
        ) : (
          <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {m['home.cta_example']()}
          </Link>
        )}
      </section>
    </div>
  )
}
