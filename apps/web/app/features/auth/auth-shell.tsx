import { Link } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { Wordmark } from '@/ui/brand'
import { ChordStill, LoopStill, Still, TabStill, TimelineStill } from '../marketing/product-still'
import { SkipLink } from '../shell/skip-link'
import { SystemBanners } from '../system/system-banners'

// Auth shell (27 §1, §3.4): the bare shell's wordmark and one narrow column, with a picture of the
// practice screen beside it from `lg` up, so signing in shows what the account is for. Phones get
// the form alone.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <SystemBanners />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col">
          <header className="flex min-h-16 items-center justify-center px-4 sm:px-8 lg:justify-start">
            <Link
              to="/"
              aria-label={m['nav.home']()}
              className="inline-flex min-h-target items-center rounded-md"
            >
              <Wordmark />
            </Link>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8 lg:py-16"
          >
            <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
              {children}
            </div>
          </main>
        </div>
        <Showcase />
      </div>
    </div>
  )
}

function Showcase() {
  const points = [
    m['auth.showcase_point_1'](),
    m['auth.showcase_point_2'](),
    m['auth.showcase_point_3'](),
  ]
  return (
    <aside
      aria-labelledby="auth-showcase"
      className="relative flex flex-col justify-center gap-10 overflow-hidden border-l border-border bg-surface-sunken px-12 py-16 max-lg:hidden xl:px-16"
    >
      <div className="flex max-w-reading flex-col gap-4">
        <h2 id="auth-showcase" className="max-w-[18ch] text-4xl text-balance">
          {m['auth.showcase_title']()}
        </h2>
        <ul className="mt-2 flex flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex gap-3 text-base text-muted-foreground">
              <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <Still className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-3 xl:p-6">
        <ChordStill />
        <TabStill bars={{ from: 4, to: 8 }} />
        <TimelineStill />
        <LoopStill />
      </Still>
    </aside>
  )
}
