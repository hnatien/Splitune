import { Link } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Wordmark } from '@/ui/brand'
import { SkipLink } from '../shell/skip-link'
import { SystemBanners } from '../system/system-banners'

// Auth shell (27 §1, §3.4, `SignIn.dc.html`): the wordmark and the 400 px form column, with the
// showcase panel beside it from `lg` up, so signing in shows what the account keeps. Phones get
// the form alone.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <SystemBanners />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,13fr)_minmax(0,14fr)]">
        <div className="flex flex-col px-4 py-7 sm:px-8">
          <header className="flex justify-center lg:justify-start">
            <Link
              to="/"
              aria-label={m['nav.home']()}
              className="inline-flex min-h-target items-center rounded-md"
            >
              <Wordmark />
            </Link>
          </header>
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto flex w-full max-w-form flex-col gap-4.5">{children}</div>
          </main>
        </div>
        <Showcase />
      </div>
    </div>
  )
}

// Chord names are notation, not copy: the same in every language.
const CHORD = 'Am'

// Speed-ladder rungs of the inert sheet (26 §12.2 SpeedLadder): two done, the current, the next.
const RUNGS = [
  { pct: 70, state: 'done', height: 'h-[70%]' },
  { pct: 75, state: 'done', height: 'h-[80%]' },
  { pct: 80, state: 'current', height: 'h-[90%]' },
  { pct: 85, state: 'next', height: 'h-full' },
] as const

const RUNG_STATE = {
  done: 'border border-signal bg-primary text-primary-foreground',
  current: 'bg-primary-soft text-primary-ink inset-ring-2 inset-ring-signal',
  next: 'bg-accent text-faint-foreground',
} as const

function Showcase() {
  const points = [
    m['auth.showcase_point_1'](),
    m['auth.showcase_point_2'](),
    m['auth.showcase_point_3'](),
  ]
  return (
    <aside
      aria-labelledby="auth-showcase"
      className="flex flex-col justify-center gap-7 border-l border-border bg-card p-12 max-lg:hidden"
    >
      <h2 id="auth-showcase" className="max-w-[12em] font-display text-3xl text-balance">
        {m['auth.showcase_title']()}
      </h2>
      <ul className="flex flex-col gap-3.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-base">
            <CheckIcon aria-hidden strokeWidth={1.8} className="size-5 shrink-0 text-primary-ink" />
            {point}
          </li>
        ))}
      </ul>
      {/* An inert picture of what stays with a song: the chord, the loop and its speed ladder. */}
      <div
        aria-hidden
        className="flex max-w-130 items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-2"
      >
        <span className="font-display text-5xl leading-none">{CHORD}</span>
        <div className="flex flex-1 flex-col gap-2">
          <Badge variant="primary" className="self-start">
            {m['auth.showcase_loop']()}
          </Badge>
          <div className="flex h-11 items-end gap-1">
            {RUNGS.map((rung) => (
              <div
                key={rung.pct}
                className={cn(
                  'flex flex-1 justify-center rounded-t-sm rounded-b-xs pt-1.25 font-mono text-2xs tabular-nums',
                  rung.height,
                  RUNG_STATE[rung.state],
                )}
              >
                {rung.pct}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
