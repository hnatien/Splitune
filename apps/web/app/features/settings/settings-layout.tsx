import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'

// Settings (27 §3.9, 26 §7): a 1180 px container with the section list (220 px) beside the
// section; on phones the list sits above it. Each section page has its own h1.

const SECTIONS = [
  { to: '/settings/account', label: () => m['settings.account']() },
  { to: '/settings/display', label: () => m['settings.display']() },
  { to: '/settings/keyboard', label: () => m['settings.keyboard']() },
  { to: '/settings/about', label: () => m['settings.about']() },
] as const

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-settings flex-wrap gap-x-10 gap-y-6 sm:pt-2 sm:pb-8">
      <nav aria-label={m['settings.sections']()} className="w-full sm:max-w-55 sm:grow sm:basis-50">
        <ul className="flex list-none flex-col gap-0.5 p-0">
          {SECTIONS.map((section) => (
            <li key={section.to}>
              <Link
                to={section.to}
                // The current section is the `.navlink` --muted fill with --foreground text; forced
                // colours pair Highlight with its text.
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'w-full justify-start px-3 aria-[current=page]:bg-muted aria-[current=page]:text-foreground forced-colors:aria-[current=page]:bg-accent forced-colors:aria-[current=page]:text-accent-foreground',
                )}
                activeProps={{ 'aria-current': 'page' }}
              >
                {section.label()}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 grow-999 basis-140">{children}</div>
    </div>
  )
}
