import { createFileRoute } from '@tanstack/react-router'
import { HowItWorks } from '@/features/marketing/how-it-works'
import { m } from '@/lib/i18n'

// How it works (27 §3.2).
export const Route = createFileRoute('/_marketing/how-it-works')({
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['how.title']() }) }] }),
  component: HowItWorks,
})
