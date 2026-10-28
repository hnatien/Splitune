import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { HowStage } from './how-scenes'

// How it works (27 §3.2): the pipeline in plain language, with an honest note on accuracy. Each
// step comes with a picture of the app that plays that step as the reader scrolls: on wide screens
// one picture pinned beside the text, switching as each step reaches the middle of the viewport; on
// narrow ones a picture in each step, playing as it rises, under a pinned bar of the four steps.
// The text carries the meaning; the pictures are inert and hidden from assistive tech, like Home's.

const SECTION = 'mx-auto w-full max-w-page px-4 md:px-6 lg:px-8'

export type ScrollPosition = { step: number; t: number }

/**
 * The step whose top has passed the middle of the viewport, and how far it has played (0–1): from
 * its top at the middle to its bottom at the viewport's bottom, so the pinned picture finishes
 * before it is released (the last step's bottom never rises past the viewport's) and holds its
 * last frame while the rest of the step scrolls by. Before the first step, the first at 0.
 */
export function scrollPosition(
  steps: readonly { top: number; height: number }[],
  viewportHeight: number,
): ScrollPosition {
  const middle = viewportHeight / 2
  let step = 0
  steps.forEach((s, i) => {
    if (s.top <= middle) step = i
  })
  const current = steps[step]
  if (!current) return { step, t: 0 }
  const span = current.height - middle
  if (span <= 0) return { step, t: current.top <= middle ? 1 : 0 }
  return { step, t: Math.min(1, Math.max(0, (middle - current.top) / span)) }
}

/** How far a picture in the flow has played: from its top at 90 % of the viewport to 40 %. */
export function riseProgress(top: number, viewportHeight: number): number {
  return Math.min(1, Math.max(0, (viewportHeight * 0.9 - top) / (viewportHeight * 0.5)))
}

type Progress = ScrollPosition & { inline: number[] }

const same = (a: Progress, b: Progress) =>
  a.step === b.step &&
  Math.abs(a.t - b.t) < 0.002 &&
  a.inline.every((t, i) => Math.abs(t - (b.inline[i] ?? 0)) < 0.002)

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
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const wide = useMediaQuery('(min-width: 64rem)')
  const list = useRef<HTMLOListElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState<Progress>({ step: 0, t: 0, inline: [0, 0, 0, 0] })

  // Measured once a frame at most, while scrolling or resizing; a re-render only when it moved.
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const items = [...(list.current?.children ?? [])]
      const height = window.innerHeight
      const next = {
        ...scrollPosition(
          items.map((item) => item.getBoundingClientRect()),
          height,
        ),
        inline: items.map((item) =>
          riseProgress(
            item.querySelector('[data-scene]')?.getBoundingClientRect().top ?? height,
            height,
          ),
        ),
      }
      setProgress((prev) => (same(prev, next) ? prev : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // A jump lands where the step's picture has just finished: beside the text, the step's bottom at
  // the viewport's; in the flow, the step's top just under the pinned bar.
  const jump = (index: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const item = list.current?.children[index]
    if (!(item instanceof HTMLElement)) return
    event.preventDefault()
    const rect = item.getBoundingClientRect()
    const offset = wide
      ? rect.bottom - window.innerHeight
      : rect.top - (bar.current?.getBoundingClientRect().height ?? 0)
    window.scrollTo({
      top: window.scrollY + offset,
      behavior: reduced ? 'instant' : 'smooth',
    })
    item.querySelector('h2')?.focus({ preventScroll: true })
  }

  const { step: current } = progress
  const played = (t: number) => (reduced ? 1 : t)
  const t = played(wide ? progress.t : (progress.inline[current] ?? 0))
  return (
    <div className="flex flex-col gap-12 pb-24 lg:gap-8 lg:pb-32">
      <header className={cn(SECTION, 'flex flex-col gap-4 pt-12 lg:pt-20')}>
        <h1 className="max-w-[14ch] text-display text-balance">{m['how.title']()}</h1>
        <p className="max-w-reading text-lg text-muted-foreground lg:text-xl lg:leading-8">
          {m['how.intro']()}
        </p>
      </header>

      <div className={cn(SECTION, 'grid lg:grid-cols-[2fr_3fr] lg:gap-x-16')}>
        <div
          ref={bar}
          className="sticky top-0 z-10 -mx-4 border-b border-border bg-background px-4 py-1 md:-mx-6 md:px-6 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:flex lg:h-svh lg:flex-col lg:justify-center lg:gap-4 lg:self-start lg:border-0 lg:px-0 lg:py-8"
        >
          <nav aria-label={m['how.nav']()}>
            <ol className="grid grid-cols-4 gap-2">
              {steps.map((step, i) => {
                const fill = i < current ? 1 : i > current ? 0 : t
                return (
                  <li key={step.title}>
                    <a
                      href={`#how-step-${i + 1}`}
                      onClick={jump(i)}
                      aria-current={i === current ? 'step' : undefined}
                      className="flex min-h-target flex-col justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground aria-[current=step]:text-foreground"
                    >
                      <span className="flex items-baseline gap-1.5 truncate">
                        <span className="tabular-nums">{i + 1}</span>
                        <span className="truncate max-sm:sr-only">{step.short}</span>
                      </span>
                      <span className="block h-1 overflow-hidden rounded-full bg-surface-sunken">
                        <span
                          className="block h-full origin-left bg-primary"
                          style={{ transform: `scaleX(${fill})` }}
                        />
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>
          <HowStage step={current} t={t} className="max-lg:hidden" />
        </div>

        <ol ref={list} className="flex flex-col lg:col-start-1 lg:row-start-1">
          {steps.map((step, i) => (
            <li
              key={step.title}
              id={`how-step-${i + 1}`}
              data-active={i === current}
              className="group flex flex-col gap-4 pt-16 lg:min-h-svh lg:justify-center lg:pt-0"
            >
              <span className="grid size-12 place-items-center rounded-full bg-accent text-xl font-semibold text-accent-foreground tabular-nums transition-colors group-data-[active=true]:bg-primary group-data-[active=true]:text-primary-foreground">
                {i + 1}
              </span>
              <h2 tabIndex={-1} className="text-3xl text-balance lg:text-4xl">
                {step.title}
              </h2>
              <p className="max-w-reading text-lg text-muted-foreground">{step.body}</p>
              <div data-scene className="mt-2 lg:hidden">
                <HowStage step={i} t={played(progress.inline[i] ?? 0)} only />
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className={cn(SECTION, 'flex flex-col gap-8')}>
        <aside className="max-w-reading rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg">{m['how.accuracy_title']()}</h2>
          <p className="mt-1 text-base text-muted-foreground">{m['how.accuracy_body']()}</p>
        </aside>
        <Link
          to="/start"
          className={cn(buttonVariants({ variant: 'primary', size: 'practice-2' }), 'self-start')}
        >
          {m['home.cta_example']()}
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
    </div>
  )
}
