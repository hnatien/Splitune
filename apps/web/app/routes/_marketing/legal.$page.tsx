import { createFileRoute, notFound } from '@tanstack/react-router'
import { legalPages } from '@/features/marketing/legal-content'
import { LegalPage } from '@/features/marketing/legal-page'
import { NotFoundMessage } from '@/features/system/error-page'
import { m } from '@/lib/i18n'

// Legal pages (27 §3.2). An unknown page is a 404 inside the marketing shell, so the navigation
// and footer stay (27 §3.11).
export const Route = createFileRoute('/_marketing/legal/$page')({
  loader: ({ params }) => {
    if (!(params.page in legalPages())) throw notFound()
  },
  head: ({ params }) => ({
    meta: [{ title: m['meta.page']({ page: legalPages()[params.page]?.title ?? '' }) }],
  }),
  component: Legal,
  notFoundComponent: () => (
    <div className="mx-auto w-full max-w-bare px-4">
      <NotFoundMessage />
    </div>
  ),
})

function Legal() {
  const { page } = Route.useParams()
  return <LegalPage page={page} />
}
