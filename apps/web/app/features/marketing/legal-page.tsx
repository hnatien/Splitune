import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { legalPages, UPDATED } from './legal-content'

// Legal pages (27 §3.2): 72 ch reading column, table of contents, last-updated date.
export function LegalPage({ page }: { page: string }) {
  const content = legalPages()[page]
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
