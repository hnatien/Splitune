import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// Doc 26 §12.2, 27 §5.4, s47 direction §4: a status glyph + what happened + what it means
// (optional) + what you can do. Status is a glyph and words, never a tinted box: the glyph's shape
// says the tone (a cross in a circle, a triangle, an "i", a check), its hue only joins in for error
// and success, and the title carries the meaning. Nothing here is filled or boxed.

export type StatusTone = 'error' | 'warning' | 'info' | 'success'

const TONES: Record<StatusTone, { icon: React.ReactNode; text: string }> = {
  error: { icon: <CircleXIcon aria-hidden />, text: 'text-destructive' },
  warning: { icon: <TriangleAlertIcon aria-hidden />, text: 'text-foreground' },
  info: { icon: <InfoIcon aria-hidden />, text: 'text-muted-foreground' },
  success: { icon: <CircleCheckIcon aria-hidden />, text: 'text-success' },
}

type StatusMessageProps = {
  tone: StatusTone
  /** What happened (one sentence). */
  title: string
  /** What it means for you (optional). */
  description?: string | undefined
  /** What you can do: Buttons. */
  actions?: React.ReactNode
  className?: string
}

/**
 * In place of content that failed to load, or under a form: the glyph, a title in the label role,
 * the explanation and the actions, on whatever surface it sits on. Announced as an alert for errors.
 */
function InlineError({
  tone = 'error',
  title,
  description,
  actions,
  className,
}: Partial<Pick<StatusMessageProps, 'tone'>> & Omit<StatusMessageProps, 'tone'>) {
  const style = TONES[tone]
  return (
    <div
      data-slot="inline-error"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 py-2', className)}
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-5 [&_.lucide]:stroke-[1.8]', style.text)}>
        {style.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-label text-foreground">{title}</p>
        {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

type BannerProps = StatusMessageProps & {
  /** Replaces the tone icon where a more specific one says it better (offline: a crossed-out wifi). */
  icon?: React.ReactNode
  /** Only non-blocking banners can be dismissed (doc 26 §12.2). */
  dismiss?: { label: string; onDismiss: () => void } | undefined
}

/**
 * Page-level notice at the top of a region (offline, worker offline, demo mode, browser support):
 * one quiet line, the tone in the icon and the words, a hairline below; no box and no tinted bar.
 */
function Banner({ tone, title, description, actions, icon, dismiss, className }: BannerProps) {
  const style = TONES[tone]
  return (
    <div
      data-slot="banner"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex animate-rise-in flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-1.5 sm:flex-nowrap',
        className,
      )}
    >
      <span className={cn('shrink-0 [&_svg]:size-4.5 [&_.lucide]:stroke-[1.8]', style.text)}>
        {icon ?? style.icon}
      </span>
      <p className="min-w-0 flex-1 basis-3xs py-2 text-body-sm text-foreground">
        <span className={cn(description && 'text-label-sm')}>{title}</span>
        {description && <span className="text-muted-foreground"> {description}</span>}
      </p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      {dismiss && (
        <Button variant="quiet" size="icon" aria-label={dismiss.label} onClick={dismiss.onDismiss}>
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  )
}

export { Banner, InlineError }
