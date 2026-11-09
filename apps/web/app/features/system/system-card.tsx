import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/ui/card'

// The system pages' card (27 §3.11, States.dc.html): a `.card` with the page's h1 in the h3 size,
// one or two sentences in muted text, then the actions. `aside` sits before the text (the 404's
// mono number); `wide` lays text and actions out in one row from `sm` when there is room.
export function SystemCard({
  title,
  aside,
  children,
  actions,
  wide = false,
  className,
}: {
  title: string
  aside?: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <Card
      className={cn(
        'gap-3 p-5.5',
        wide && 'sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3.5',
        className,
      )}
    >
      {aside}
      <div className={cn('flex min-w-0 flex-col gap-1', wide && 'sm:flex-1 sm:basis-56')}>
        <h1 className="text-lg">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Card>
  )
}

/** The sentence under a system card's title. */
export function SystemText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
