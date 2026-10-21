import { createFileRoute } from '@tanstack/react-router'
import { ImportPage } from '@/features/import/import-page'
import { m } from '@/lib/i18n'

// Import (27 §3.6): client-rendered (10 §1) — file pickers, Workers, IndexedDB and the microphone
// are browser-only.
export const Route = createFileRoute('/_app/import')({
  ssr: false,
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['import.title']() }) }] }),
  component: Import,
})

function Import() {
  const { me } = Route.useRouteContext()
  return <ImportPage me={me} />
}
