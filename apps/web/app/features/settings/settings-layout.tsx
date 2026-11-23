import { Link, useRouterState } from '@tanstack/react-router'
import type * as React from 'react'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import { RAIL_ITEM } from '../shell/app-shell'

// Settings (s47 direction §6, 27 §3.9): one column at the settings width. From 768 px the section
// list sits beside the section as quiet rows, the current one marked by the rail's 2 px ink line;
// below that it is one line of tabs under a hairline that scrolls sideways, the current section
// underlined in ink and scrolled into view, so the section's own h1 stays near the top.

const SECTIONS = [
  { to: '/settings/account', label: () => m['settings.account']() },
  { to: '/settings/usage', label: () => m['settings.usage']() },
  { to: '/settings/plan', label: () => m['settings.billing']() },
  { to: '/settings/display', label: () => m['settings.display']() },
  { to: '/settings/keyboard', label: () => m['settings.keyboard']() },
  { to: '/settings/about', label: () => m['settings.about']() },
] as const

const LINE_TAB =
  'flex min-h-target shrink-0 items-center border-b-2 border-transparent px-3 text-label whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground aria-[current=page]:border-selected aria-[current=page]:text-foreground focus-visible:-outline-offset-2'

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const line = useRef<HTMLUListElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the section on navigation
  useEffect(() => {
    line.current
      ?.querySelector('[aria-current=page]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])
  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <nav aria-label={m['settings.sections']()} className="md:w-48 md:shrink-0">
        <ul
          ref={line}
          className="m-0 -mx-4 flex list-none overflow-x-auto border-b border-border px-4 md:hidden"
        >
          {SECTIONS.map((section) => (
            <li key={section.to} className="-mb-px">
              <Link to={section.to} className={LINE_TAB} activeProps={{ 'aria-current': 'page' }}>
                {section.label()}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 max-md:hidden md:sticky md:top-8">
          {SECTIONS.map((section) => (
            <li key={section.to}>
              <Link to={section.to} className={RAIL_ITEM} activeProps={{ 'aria-current': 'page' }}>
                {section.label()}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
