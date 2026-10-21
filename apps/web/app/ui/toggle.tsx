import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Doc 26 §12.1: pressed = --accent fill + indigo text + an indigo edge (callers add a check or
// filled icon), so the state never rests on colour alone.
const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-2 rounded-lg border font-medium whitespace-nowrap transition-colors hover:bg-muted data-pressed:border-primary data-pressed:bg-accent data-pressed:text-primary disabled:pointer-events-none disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: 'border-transparent bg-transparent text-foreground',
        outline: 'border-input bg-card text-foreground',
      },
      size: {
        sm: 'min-h-target-sm min-w-target-sm rounded-md px-2.5 text-sm [&_svg:not([class*=size-])]:size-4',
        md: 'min-h-control min-w-control px-3 text-base',
        'practice-2': 'min-h-target-practice-2 min-w-target-practice-2 px-4 text-base',
        practice:
          'min-h-target-practice min-w-target-practice rounded-xl px-5 text-lg [&_svg:not([class*=size-])]:size-7',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'md',
    },
  },
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
