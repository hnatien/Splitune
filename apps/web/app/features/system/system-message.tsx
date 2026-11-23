import { useQuery } from '@tanstack/react-query'
import type * as React from 'react'
import { useId } from 'react'
import { meQuery } from '@/lib/session'
import { cn } from '@/lib/utils'

// A system page's message (27 §3.11, s47 direction §1): a plain message with no card or box
// around it. It sits at the top of its column under the wordmark, not floating in the middle of an
// empty viewport: an optional quiet marker (the 404 numeral), a one-sentence h1, what it means in
// muted text, then one primary action and at most one quiet way out.
export function SystemMessage({
  title,
  marker,
  children,
  actions,
  className,
}: {
  title: string
  marker?: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn('flex flex-col items-start gap-6 pt-8 pb-16 sm:pt-16', className)}
    >
      {marker}
      <div className="flex min-w-0 flex-col gap-3">
        <h1 id={id} className="text-display text-balance">
          {title}
        </h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </section>
  )
}

/** A sentence under a system page's heading. */
export function SystemText({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-pretty text-muted-foreground">{children}</p>
}

/**
 * Whether a visitor is signed in, from the session the root route already loaded. Never fetches:
 * a system page must render even when the request behind it is what failed.
 */
export function useSignedIn(): boolean {
  return Boolean(useQuery({ ...meQuery, enabled: false }).data)
}
