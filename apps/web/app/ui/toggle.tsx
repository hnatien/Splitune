import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Doc 26 §12.1 `.chip`: a pill painted at 30 px inside the target box (§8, V12: 44 browse, 48 in
// practice density), padded out with a transparent border. Pressed = --primary-soft wash, a
// --primary-line edge (≥ 3:1, the non-colour cue) and --primary-ink text. The practice sizes paint
// their whole box.
const toggleVariants = cva(
  "group/toggle inline-flex min-h-(--box) min-w-(--box) shrink-0 items-center justify-center gap-1.5 border-(length:--pad) border-transparent bg-clip-padding whitespace-nowrap inset-ring transition-[color,background-color,box-shadow] duration-(--duration-fast) select-none [--pad:calc((var(--box)-var(--face))/2)] focus-visible:outline-offset-[calc(2px-var(--pad))] not-data-pressed:hover:bg-muted not-data-pressed:hover:text-foreground disabled:pointer-events-none disabled:bg-muted disabled:text-faint-foreground disabled:inset-ring-input data-pressed:bg-primary-soft data-pressed:text-primary-ink data-pressed:inset-ring-primary-line forced-colors:data-pressed:bg-card [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_.lucide]:stroke-[1.8]",
  {
    variants: {
      variant: {
        default: 'text-muted-foreground inset-ring-transparent',
        outline: 'text-muted-foreground inset-ring-border-strong',
      },
      size: {
        sm: 'rounded-full px-2.75 text-sm font-[550] [--box:var(--control-size)] [--face:1.875rem]',
        md: 'rounded-full px-2.75 text-sm font-[550] [--box:var(--control-size)] [--face:1.875rem]',
        'practice-2':
          'rounded-xl px-3 text-md [--box:var(--target-practice-2)] [--face:var(--box)] [&_svg:not([class*=size-])]:size-5',
        practice:
          'rounded-2xl px-5 text-lg [--box:var(--target-practice)] [--face:var(--box)] [&_svg:not([class*=size-])]:size-6',
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
