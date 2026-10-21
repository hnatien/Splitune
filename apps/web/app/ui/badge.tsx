import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Status badges are text first ("Ready", "Rough tab", "Chords only") with an icon; status colour is
// only ever text, icon and a hairline border (doc 26 §4.3, §5).
const badgeVariants = cva(
  'group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-muted text-foreground',
        outline: 'border-input bg-transparent text-foreground',
        primary: 'border-transparent bg-accent text-accent-foreground',
        success: 'border-success bg-transparent text-success',
        warning: 'border-warning bg-transparent text-warning',
        info: 'border-info bg-transparent text-info',
        destructive: 'border-destructive bg-transparent text-destructive',
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
