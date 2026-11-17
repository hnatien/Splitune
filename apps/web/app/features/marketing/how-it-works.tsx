import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { HowStage } from './how-scenes'

// How it works (27 §3.2): the pipeline in plain language, with an honest note on accuracy. A centred
// title, then a row of pill links to the four steps; each step is its own generous section, the
// text on the left and a still picture of the app at that step beside it on wide screens (under it
// on narrow ones). The text carries the meaning; the pictures are inert and hidden from assistive
// tech, like Home's. No scroll-driven motion.

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
    <div className="flex flex-col pb-24">
      <header
        className={cn(SECTION, 'flex flex-col items-center gap-10 pt-20 text-center sm:pt-24')}
      >
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl text-balance max-sm:text-4xl">{m['how.title']()}</h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">
            {m['how.intro']()}
          </p>
        </div>
        <nav aria-label={m['how.nav']()}>
          <ol className="flex flex-wrap justify-center gap-2">
            {steps.map((step, i) => (
              <li key={step.title}>
                <a href={`#how-step-${i + 1}`} className={buttonVariants({ variant: 'secondary' })}>
                  {step.short}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <ol className={cn(SECTION, 'flex flex-col')}>
        {steps.map((step, i) => (
          <li
            key={step.title}
            id={`how-step-${i + 1}`}
            className="grid scroll-mt-16 items-start gap-10 py-20 sm:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16"
          >
            <div className="flex flex-col gap-4 lg:pt-6">
              <h2 className="text-3xl text-balance max-sm:text-2xl">{step.title}</h2>
              <p className="max-w-reading text-lead text-muted-foreground">{step.body}</p>
            </div>
            <HowStage step={i} />
          </li>
        ))}
      </ol>

      <section
        className={cn(SECTION, 'flex flex-col items-center gap-8 py-20 text-center sm:py-24')}
      >
        <div className="flex max-w-reading flex-col items-center gap-4">
          <h2 className="text-3xl text-balance max-sm:text-2xl">{m['how.accuracy_title']()}</h2>
          <p className="text-lead text-pretty text-muted-foreground">{m['how.accuracy_body']()}</p>
        </div>
        <Link to="/start" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
          {m['home.cta_example']()}
        </Link>
      </section>
    </div>
  )
}
