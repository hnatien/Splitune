import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// `.badge` (doc 26 §12.1): 22 px pills in 12/650, always text ("Ready", "Rough tab", "Chords only"),
// optionally an icon or a Spinner; status colour is the text on its own surface, never colour alone
// (§4.3, §4.8, §5). Warnings and info are neutral with their icon (amber is reserved, §4.5).
const badgeVariants = cva(
  'group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1.25 overflow-hidden rounded-full px-2 text-xs whitespace-nowrap [&_[data-slot=spinner]]:size-3 [&>svg]:pointer-events-none [&>svg]:size-3.5 [&_.lucide]:stroke-[1.8]',
  {
    variants: {
      variant: {
        neutral: 'bg-accent text-muted-foreground',
        outline: 'bg-transparent text-muted-foreground inset-ring inset-ring-border-strong',
        primary: 'bg-primary-soft text-primary-ink',
        success: 'bg-success-surface text-success',
        warning: 'bg-warning-surface text-warning',
        info: 'bg-info-surface text-info inset-ring inset-ring-border',
        destructive: 'bg-destructive-surface text-destructive',
        unsure: 'bg-unsure-surface text-unsure',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

function Badge({
  className,
  variant,
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
