import type * as React from 'react'
import { cn } from '@/lib/utils'

// A system page's message (27 §3.11): no card, centred in the bare shell's column. A one-sentence
// h1, one supporting sentence in muted text, then the actions: one primary pill and a text link.
// `aside` sits above the heading (the 404's mono number).
export function SystemCard({
  title,
  aside,
  children,
  actions,
  className,
}: {
  title: string
  aside?: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('my-auto flex flex-col items-center gap-6 py-12 text-center', className)}>
      {aside}
      <div className="flex min-w-0 flex-col items-center gap-2">
        <h1 className="text-display text-balance">{title}</h1>
        {children}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">{actions}</div>
      )}
    </div>
  )
}

/** The sentence under a system page's heading. */
export function SystemText({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-pretty text-muted-foreground">{children}</p>
}
