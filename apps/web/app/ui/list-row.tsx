import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * ListGroup (doc 26 §12.2): a quiet head ("Ready to practise · 5") over hairline rows. Lists are
 * the app's default container: no card around a row, no box around a group.
 */
function ListGroup({
  title,
  count,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  title?: React.ReactNode
  count?: number
  action?: React.ReactNode
}) {
  return (
    <section data-slot="list-group" className={cn('flex flex-col', className)} {...props}>
      {title !== undefined && (
        <header className="flex min-h-10 items-center gap-2 border-b border-border">
          <h2 className="text-label-sm text-muted-foreground">{title}</h2>
          {count !== undefined && (
            <span className="text-caption text-faint-foreground tabular-nums">{count}</span>
          )}
          {action && <div className="ml-auto flex items-center">{action}</div>}
        </header>
      )}
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </section>
  )
}

/**
 * ListRow (doc 26 §12.2): one hairline row. `media` leads (a MusicStrip, an icon), then the title
 * and one meta line, then whatever the caller puts in `aside` (a Status, one action, a ⋯ menu).
 *
 * With `render` the title area becomes the row's link or button and its target grows to the whole
 * row (a stretched ::after), so the row has one main action and the aside's controls stay their
 * own targets above it. The current row is marked by a 2 px ink edge on its leading side.
 */
function ListRow({
  media,
  title,
  meta,
  aside,
  current = false,
  render,
  className,
  ...props
}: Omit<useRender.ComponentProps<'div'>, 'title' | 'children'> & {
  media?: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
  aside?: React.ReactNode
  current?: boolean
}) {
  const main = useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: cn(
          'flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 focus-visible:outline-offset-[-2px]',
          render &&
            'after:absolute after:inset-0 hover:[&_[data-slot=list-row-title]]:underline hover:[&_[data-slot=list-row-title]]:underline-offset-4',
        ),
        children: (
          <>
            <ListRowTitle>{title}</ListRowTitle>
            {meta && <ListRowMeta>{meta}</ListRowMeta>}
          </>
        ),
      },
      props,
    ),
  })
  return (
    <li
      data-slot="list-row"
      data-current={current || undefined}
      className={cn(
        'group/list-row relative flex min-h-14 items-center gap-3 border-b border-border px-2 transition-colors duration-(--duration-fast) hover:bg-hover',
        current &&
          'before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-selected',
        className,
      )}
    >
      {media && <div className="relative z-10 shrink-0 text-muted-foreground">{media}</div>}
      {main}
      {aside && <div className="relative z-10 flex shrink-0 items-center gap-2">{aside}</div>}
    </li>
  )
}

function ListRowTitle({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="list-row-title"
      className={cn('truncate text-label text-foreground', className)}
      {...props}
    />
  )
}

function ListRowMeta({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="list-row-meta"
      className={cn('truncate text-caption text-muted-foreground tabular-nums', className)}
      {...props}
    />
  )
}

export { ListGroup, ListRow, ListRowMeta, ListRowTitle }
