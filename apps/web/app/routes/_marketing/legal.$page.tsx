import { createFileRoute, notFound } from '@tanstack/react-router'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'

// Legal pages (27 §3.2): 72 ch reading column, table of contents, last-updated date. Personal mode
// (25 §8): plain terms and privacy notes for a private deployment.

type Section = { id: string; title: string; body: string }

const UPDATED = new Date(2026, 9, 22)

function pages(): Record<string, { title: string; sections: Section[] }> {
  return {
    terms: {
      title: m['legal.terms_title'](),
      sections: [
        {
          id: 'service',
          title: m['legal.terms.service_title'](),
          body: m['legal.terms.service_body'](),
        },
        {
          id: 'your-songs',
          title: m['legal.terms.songs_title'](),
          body: m['legal.terms.songs_body'](),
        },
        {
          id: 'accuracy',
          title: m['legal.terms.accuracy_title'](),
          body: m['legal.terms.accuracy_body'](),
        },
        {
          id: 'billing',
          title: m['legal.terms.billing_title'](),
          body: m['legal.terms.billing_body'](),
        },
        {
          id: 'ending',
          title: m['legal.terms.ending_title'](),
          body: m['legal.terms.ending_body'](),
        },
      ],
    },
    privacy: {
      title: m['legal.privacy_title'](),
      sections: [
        {
          id: 'what',
          title: m['legal.privacy.what_title'](),
          body: m['legal.privacy.what_body'](),
        },
        {
          id: 'where',
          title: m['legal.privacy.where_title'](),
          body: m['legal.privacy.where_body'](),
        },
        {
          id: 'device',
          title: m['legal.privacy.device_title'](),
          body: m['legal.privacy.device_body'](),
        },
        {
          id: 'delete',
          title: m['legal.privacy.delete_title'](),
          body: m['legal.privacy.delete_body'](),
        },
      ],
    },
  }
}

export const Route = createFileRoute('/_marketing/legal/$page')({
  loader: ({ params }) => {
    if (!(params.page in pages())) throw notFound()
  },
  head: ({ params }) => ({
    meta: [{ title: m['meta.page']({ page: pages()[params.page]?.title ?? '' }) }],
  }),
  component: LegalPage,
})

function LegalPage() {
  const { page } = Route.useParams()
  const content = pages()[page]
  if (!content) return null
  return (
    <article className="mx-auto flex max-w-reading flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl">{content.title}</h1>
        <p className="text-sm text-muted-foreground">
          {m['legal.updated']({ date: formatDate(UPDATED, UPDATED) })}
        </p>
      </header>
      <nav aria-labelledby="toc" className="rounded-xl border border-border bg-card p-5">
        <h2 id="toc" className="text-base font-semibold">
          {m['legal.toc']()}
        </h2>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
          {content.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {content.sections.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-20 flex-col gap-2">
          <h2 className="text-xl">{section.title}</h2>
          <p className="text-base leading-7">{section.body}</p>
        </section>
      ))}
    </article>
  )
}
