import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { legalPages, UPDATED } from './legal-content'

// Legal pages (27 §3.2): 72 ch reading column, table of contents, last-updated date.
export function LegalPage({ page }: { page: string }) {
  const content = legalPages()[page]
  if (!content) return null
  return (
    <article className="mx-auto flex w-full max-w-reading flex-col gap-8 px-4 pt-14 pb-18 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl text-balance">{content.title}</h1>
        <p className="text-sm text-faint-foreground">
          {m['legal.updated']({ date: formatDate(UPDATED, UPDATED) })}
        </p>
      </header>
      <nav aria-labelledby="toc" className="rounded-3xl border border-border bg-card p-5">
        <h2 id="toc" className="text-lg">
          {m['legal.toc']()}
        </h2>
        <ol className="mt-2 flex list-decimal flex-col pl-5 marker:text-faint-foreground">
          {content.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex min-h-target items-center text-base text-primary-ink underline underline-offset-4 hover:decoration-2"
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
          <p className="text-lead text-pretty">{section.body}</p>
        </section>
      ))}
    </article>
  )
}
