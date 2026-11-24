import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { legalPages, UPDATED } from './legal-content'
import { useCurrentSection } from './use-current-section'

// Legal pages (27 §3.2): a 72 ch reading column with the title and the full last-updated date, and
// the table of contents: in the left margin, held in view while reading, on wide screens, where
// the section being read is marked with a 2 px ink line on its leading side (aria-current); between
// hairlines above the text on narrow ones. Section heads are in the heading role, a step above
// the body, so they never outweigh their one or two sentences.

const UPDATED_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function LegalPage({ page }: { page: string }) {
  const content = legalPages()[page]
  const current = useCurrentSection(content?.sections.map((section) => section.id) ?? [])
  if (!content) return null
  return (
    <div className="mx-auto grid w-full max-w-page gap-x-12 px-4 pt-12 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_minmax(0,var(--container-reading))_1fr] lg:px-8">
      <header className="flex flex-col gap-2 lg:col-start-2">
        <h1 className="text-display text-balance">{content.title}</h1>
        <p className="text-body-sm text-muted-foreground">
          {m['legal.updated']({ date: UPDATED_DATE.format(UPDATED) })}
        </p>
      </header>
      <nav
        aria-labelledby="toc"
        className="mt-8 border-y border-border py-3 lg:sticky lg:top-24 lg:col-start-1 lg:row-start-2 lg:mt-12 lg:w-48 lg:self-start lg:justify-self-end lg:border-0 lg:py-0"
      >
        <h2 id="toc" className="text-label-sm text-muted-foreground">
          {m['legal.toc']()}
        </h2>
        <ol className="mt-1 flex flex-col">
          {content.sections.map((section) => {
            const here = current === section.id
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={here ? 'location' : undefined}
                  className={cn(
                    'relative flex min-h-target items-center rounded-field px-3 text-label text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-hover hover:text-foreground',
                    here &&
                      'text-foreground before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-selected',
                  )}
                >
                  {section.title}
                </a>
              </li>
            )
          })}
        </ol>
      </nav>
      <article className="flex flex-col lg:col-start-2 lg:row-start-2">
        {content.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="flex scroll-mt-24 flex-col gap-2 pt-10 lg:pt-12"
          >
            <h2 className="text-heading">{section.title}</h2>
            <p className="text-lead text-pretty">{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  )
}
