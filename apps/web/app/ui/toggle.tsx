import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Doc 26 §12.1 chip: a pill whose face sits inside the target box (§8: 44 browse, 48 in practice
// density), padded out with a transparent border. "On" is the 1.5 px ink edge with ink text and
// `aria-pressed`, never a grey fill; `invert` fills the chip with the ink instead, for the
// one- and two-letter toggles (M, S) where an edge alone is too slight. `dot` adds a hollow dot
// that fills when on, for toggles that name a setting rather than a choice.
const toggleVariants = cva(
  "group/toggle inline-flex min-h-(--box) min-w-(--box) shrink-0 items-center justify-center gap-1.5 rounded-full border-(length:--pad) border-transparent bg-clip-padding whitespace-nowrap inset-ring transition-[color,background-color,box-shadow] duration-(--duration-fast) ease-standard select-none [--pad:calc((var(--box)-var(--face))/2)] focus-visible:outline-offset-[calc(2px-var(--pad))] not-data-pressed:hover:bg-hover not-data-pressed:hover:text-foreground disabled:pointer-events-none disabled:text-faint-foreground disabled:inset-ring-edge data-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_.lucide]:stroke-[1.8]",
  {
    variants: {
      variant: {
        default:
          'text-muted-foreground inset-ring-transparent data-pressed:inset-ring-[1.5px] data-pressed:inset-ring-selected',
        outline:
          'text-muted-foreground inset-ring-border-strong data-pressed:inset-ring-[1.5px] data-pressed:inset-ring-selected',
        invert:
          'text-muted-foreground inset-ring-border-strong data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:inset-ring-primary data-pressed:hover:bg-primary-hover',
      },
      size: {
        sm: 'px-3 text-label-sm [--box:var(--control-size)] [--face:2.25rem]',
        md: 'px-3.5 text-label [--box:var(--control-size)] [--face:2.5rem]',
        practice:
          'px-4 text-label [--box:var(--target-practice)] [--face:var(--box)] [&_svg:not([class*=size-])]:size-5',
        play: 'px-5 text-title [--box:var(--target-play)] [--face:var(--box)] [&_svg:not([class*=size-])]:size-6',
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
  dot = false,
  children,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants> & { dot?: boolean }) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          data-slot="toggle-dot"
          className="size-2 shrink-0 rounded-full inset-ring-[1.5px] inset-ring-current group-data-pressed/toggle:bg-current"
        />
      )}
      {children}
    </TogglePrimitive>
  )
}

export { Toggle, toggleVariants }
