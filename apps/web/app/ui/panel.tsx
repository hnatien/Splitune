import { XIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

/**
 * Panel (doc 26 §12.2): the one side panel a screen may dock (the practice tools, the analysis
 * while a song is getting ready, the app rail). A --panel surface with one hairline on the edge
 * that faces the content; it does not float, so it casts no shadow. On narrow screens the same
 * content is shown in a Drawer sheet instead: the Panel parts lay out the same inside either.
 */
function Panel({
  side = 'right',
  className,
  ...props
}: React.ComponentProps<'aside'> & { side?: 'left' | 'right' }) {
  return (
    <aside
      data-slot="panel"
      data-side={side}
      className={cn(
        'flex min-h-0 w-85 shrink-0 flex-col border-border bg-panel text-foreground data-[side=left]:border-r data-[side=right]:border-l',
        className,
      )}
      {...props}
    />
  )
}

function PanelHeader({
  onClose,
  closeLabel,
  closeShortcut,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  onClose?: () => void
  closeLabel?: string
  closeShortcut?: string
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn('flex min-h-13 shrink-0 items-center gap-2 pr-2 pl-4', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {onClose && (
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label={closeLabel}
          aria-keyshortcuts={closeShortcut}
          onClick={onClose}
        >
          <XIcon />
        </Button>
      )}
    </div>
  )
}

function PanelTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot="panel-title" className={cn('truncate text-title', className)} {...props} />
}

/** The scrolling body. Its top hairline appears only under a header. */
function PanelBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-body"
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4', className)}
      {...props}
    />
  )
}

/** A titled block inside the body; blocks are separated by space and one hairline. */
function PanelSection({
  title,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  title?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section
      data-slot="panel-section"
      className={cn('flex flex-col gap-3 border-t border-border py-4 first:border-t-0', className)}
      {...props}
    >
      {(title || action) && (
        <div className="flex min-h-6 items-center justify-between gap-2">
          {title && <h3 className="text-label-sm text-muted-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export { Panel, PanelBody, PanelHeader, PanelSection, PanelTitle }
