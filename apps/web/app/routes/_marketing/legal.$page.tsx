import { createFileRoute, notFound } from '@tanstack/react-router'
import { legalPages } from '@/features/marketing/legal-content'
import { LegalPage } from '@/features/marketing/legal-page'
import { m } from '@/lib/i18n'

// Legal pages (27 §3.2).
export const Route = createFileRoute('/_marketing/legal/$page')({
  loader: ({ params }) => {
    if (!(params.page in legalPages())) throw notFound()
  },
  head: ({ params }) => ({
    meta: [{ title: m['meta.page']({ page: legalPages()[params.page]?.title ?? '' }) }],
  }),
  component: Legal,
})

function Legal() {
  const { page } = Route.useParams()
  return <LegalPage page={page} />
}
