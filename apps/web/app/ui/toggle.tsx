import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Doc 26 §12.1 chip: a pill painted at 30 px inside the target box (§8, V12: 44 browse, 48 in
// practice density), padded out with a transparent border. A pressed chip is filled with the ink
// (the fill is the non-colour cue). The practice sizes paint their whole box and sit beside Play,
// so pressed there is the quieter --wash wash with a --selected edge (≥ 3:1).
const CHIP_PRESSED =
  'data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:inset-ring-primary data-pressed:hover:bg-primary-hover data-pressed:hover:text-primary-foreground'

const toggleVariants = cva(
  "group/toggle inline-flex min-h-(--box) min-w-(--box) shrink-0 items-center justify-center gap-1.5 border-(length:--pad) border-transparent bg-clip-padding whitespace-nowrap inset-ring transition-[color,background-color,box-shadow] duration-(--duration-fast) select-none [--pad:calc((var(--box)-var(--face))/2)] focus-visible:outline-offset-[calc(2px-var(--pad))] not-data-pressed:hover:bg-panel not-data-pressed:hover:text-foreground disabled:pointer-events-none disabled:bg-panel disabled:text-faint-foreground disabled:inset-ring-edge data-pressed:bg-wash data-pressed:text-foreground data-pressed:inset-ring-selected forced-colors:data-pressed:bg-raised [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_.lucide]:stroke-[1.8]",
  {
    variants: {
      variant: {
        default: 'text-muted-foreground inset-ring-transparent',
        outline: 'text-muted-foreground inset-ring-border-strong',
      },
      size: {
        sm: `rounded-full px-2.75 text-body-sm font-medium [--box:var(--control-size)] [--face:1.875rem] ${CHIP_PRESSED}`,
        md: `rounded-full px-2.75 text-body-sm font-medium [--box:var(--control-size)] [--face:1.875rem] ${CHIP_PRESSED}`,
        'practice-2':
          'rounded-full px-3 text-label [--box:var(--target-practice)] [--face:var(--box)] [&_svg:not([class*=size-])]:size-5',
        practice:
          'rounded-full px-5 text-title [--box:var(--target-play)] [--face:var(--box)] [&_svg:not([class*=size-])]:size-6',
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
