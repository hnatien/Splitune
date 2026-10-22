import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ImportPage } from '@/features/import/import-page'
import { m } from '@/lib/i18n'

// Import (27 §3.6): client-rendered (10 §1) — file pickers, Workers, IndexedDB and the microphone
// are browser-only. `?tab=record` opens a tab directly (onboarding's "Record yourself").
export const Route = createFileRoute('/_app/import')({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(['file', 'link', 'record']).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['import.title']() }) }] }),
  component: Import,
})

function Import() {
  const { me } = Route.useRouteContext()
  const { tab } = Route.useSearch()
  return <ImportPage me={me} tab={tab} />
}
