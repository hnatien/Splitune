import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// Doc 26 §12.2, 27 §5.4: status icon + what happened + what it means (optional) + what you can do.
// Status colour is the icon and a tinted surface (a hairline border returns under increased
// contrast) — never a saturated fill, and the title carries the meaning.

export type StatusTone = 'error' | 'warning' | 'info' | 'success'

const TONES: Record<
  StatusTone,
  { icon: React.ReactNode; text: string; surface: string; border: string }
> = {
  error: {
    icon: <CircleXIcon aria-hidden />,
    text: 'text-destructive',
    surface: 'bg-destructive-surface',
    border: 'contrast-more:border-destructive',
  },
  warning: {
    icon: <TriangleAlertIcon aria-hidden />,
    text: 'text-warning',
    surface: 'bg-warning-surface',
    border: 'contrast-more:border-warning',
  },
  info: {
    icon: <InfoIcon aria-hidden />,
    text: 'text-info',
    surface: 'bg-info-surface',
    border: 'contrast-more:border-info',
  },
  success: {
    icon: <CircleCheckIcon aria-hidden />,
    text: 'text-success',
    surface: 'bg-success-surface',
    border: 'contrast-more:border-success',
  },
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

/** In place of content that failed to load, or under a form; announced as an alert for errors. */
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
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-xl border border-transparent p-4',
        style.surface,
        style.border,
        className,
      )}
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-5', style.text)}>{style.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-foreground">{description}</p>}
        {actions && <div className="mt-2 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  )
}

type BannerProps = StatusMessageProps & {
  /** Only non-blocking banners can be dismissed (doc 26 §12.2). */
  dismiss?: { label: string; onDismiss: () => void } | undefined
}

/** Page-level notice at the top of a region (offline, worker offline, demo mode, browser support). */
function Banner({ tone, title, description, actions, dismiss, className }: BannerProps) {
  const style = TONES[tone]
  return (
    <div
      data-slot="banner"
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex animate-rise-in flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-transparent px-4 py-3 sm:flex-nowrap',
        style.surface,
        style.border,
        className,
      )}
    >
      <span className={cn('shrink-0 [&_svg]:size-5', style.text)}>{style.icon}</span>
      <p className="min-w-0 flex-1 basis-3xs text-sm text-foreground">
        <span className="font-medium">{title}</span>
        {description && <span> {description}</span>}
      </p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      {dismiss && (
        <Button variant="ghost" size="icon" aria-label={dismiss.label} onClick={dismiss.onDismiss}>
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  )
}

export { Banner, InlineError }
