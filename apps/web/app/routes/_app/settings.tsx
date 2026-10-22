import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SettingsLayout } from '@/features/settings/settings-layout'
import { m } from '@/lib/i18n'

// Settings (27 §3.9): the section list and the selected section. data-only SSR (10 §1).
export const Route = createFileRoute('/_app/settings')({
  ssr: 'data-only',
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['settings.title']() }) }] }),
  component: () => (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  ),
})
