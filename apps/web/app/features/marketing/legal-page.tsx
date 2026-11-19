import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { legalPages, UPDATED } from './legal-content'

// Legal pages (27 §3.2): a 72 ch reading column with the title and last-updated date, and the table
// of contents: in the left margin, held in view while reading, on wide screens; between hairlines
// above the text on narrow ones.
export function LegalPage({ page }: { page: string }) {
  const content = legalPages()[page]
  if (!content) return null
  return (
    <div className="mx-auto grid w-full max-w-marketing gap-x-12 px-4 pt-20 pb-24 sm:px-6 sm:pt-24 lg:grid-cols-[1fr_minmax(0,var(--container-reading))_1fr]">
      <header className="flex flex-col gap-3 lg:col-start-2">
        <h1 className="text-4xl text-balance max-sm:text-3xl">{content.title}</h1>
        <p className="text-sm text-faint-foreground">
          {m['legal.updated']({ date: formatDate(UPDATED, UPDATED) })}
        </p>
      </header>
      <nav
        aria-labelledby="toc"
        className="mt-10 border-y border-border py-4 lg:sticky lg:top-24 lg:col-start-1 lg:row-start-2 lg:mt-14 lg:self-start lg:justify-self-end lg:border-0 lg:py-0"
      >
        <h2 id="toc" className="text-sm font-medium text-muted-foreground">
          {m['legal.toc']()}
        </h2>
        <ol className="mt-1 flex flex-col">
          {content.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex min-h-target items-center text-md text-muted-foreground transition-colors hover:text-foreground"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article className="flex flex-col lg:col-start-2 lg:row-start-2">
        {content.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="flex scroll-mt-20 flex-col gap-3 pt-12 lg:pt-14"
          >
            <h2 className="text-2xl">{section.title}</h2>
            <p className="text-lead text-pretty">{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  )
}
