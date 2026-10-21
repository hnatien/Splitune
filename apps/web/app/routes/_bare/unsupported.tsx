import { createFileRoute } from '@tanstack/react-router'
import { UnsupportedBrowser } from '@/features/system/unsupported'
import { m } from '@/lib/i18n'

export const Route = createFileRoute('/_bare/unsupported')({
  ssr: false,
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['system.unsupported_title']() }) }] }),
  component: UnsupportedBrowser,
})
