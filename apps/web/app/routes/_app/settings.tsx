import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'

// Settings (27 §3.9): a section list beside the page on tablet and desktop, above it on phones.
// data-only SSR (10 §1).
export const Route = createFileRoute('/_app/settings')({
  ssr: 'data-only',
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['settings.title']() }) }] }),
  component: SettingsLayout,
})

const SECTIONS = [
  { to: '/settings/profile', label: () => m['settings.profile']() },
  { to: '/settings/display', label: () => m['settings.display']() },
  { to: '/settings/keyboard', label: () => m['settings.keyboard']() },
  { to: '/settings/billing', label: () => m['settings.billing']() },
  { to: '/settings/privacy', label: () => m['settings.privacy']() },
] as const

function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{m['settings.title']()}</h1>
      <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={m['settings.sections']()}>
          <ul className="flex list-none flex-col gap-1 p-0">
            {SECTIONS.map((section) => (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={cn(buttonVariants({ variant: 'ghost' }), 'w-full justify-start')}
                  activeProps={{
                    'aria-current': 'page',
                    className: 'bg-accent text-accent-foreground',
                  }}
                >
                  {section.label()}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
