import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'

// How it works (27 §3.2): the pipeline in plain language, with an honest note on accuracy.
export function HowItWorks() {
  const steps = [
    { title: m['how.step_1_title'](), body: m['how.step_1_body']() },
    { title: m['how.step_2_title'](), body: m['how.step_2_body']() },
    { title: m['how.step_3_title'](), body: m['how.step_3_body']() },
    { title: m['how.step_4_title'](), body: m['how.step_4_body']() },
  ]
  return (
    <div className="mx-auto flex max-w-reading flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl">{m['how.title']()}</h1>
        <p className="text-lg text-muted-foreground">{m['how.intro']()}</p>
      </header>
      <ol className="flex flex-col gap-6">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground tabular-nums">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl">{step.title}</h2>
              <p className="text-base text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <aside className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg">{m['how.accuracy_title']()}</h2>
        <p className="mt-1 text-base text-muted-foreground">{m['how.accuracy_body']()}</p>
      </aside>
      <Link to="/start" className={cn(buttonVariants({ variant: 'primary' }), 'self-start')}>
        {m['home.cta_example']()}
      </Link>
    </div>
  )
}
