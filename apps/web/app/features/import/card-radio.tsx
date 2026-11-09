import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

// Add song's radio cards (27 §3.6, AddSong and Phone-Add): `.card` radios for Your part and
// Analysis, and `.chip` radios for the phone's part row. Checked = a --signal border plus a 1 px
// inset --signal ring on the --primary-soft wash (26 §12.3: the 2 px edge is the cue, never colour
// alone). Locked choices are disabled with a muted face and say why beside them (23 §5).

export function CardRadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive className={cn('grid gap-2', className)} {...props} />
}

const LOOK = {
  card: 'min-h-target rounded-3xl border border-border bg-card px-3.5 py-3 text-left hover:bg-muted data-checked:border-signal data-checked:bg-primary-soft data-checked:inset-ring data-checked:inset-ring-signal',
  chip: 'min-h-11 rounded-full border-2 border-transparent bg-clip-padding px-3 text-sm font-[550] text-muted-foreground inset-ring inset-ring-border-strong data-checked:bg-primary-soft data-checked:text-primary-ink data-checked:inset-ring-primary-line',
}

export function CardRadio({
  look = 'card',
  className,
  ...props
}: RadioPrimitive.Root.Props & { look?: keyof typeof LOOK }) {
  return (
    <RadioPrimitive.Root
      className={cn(
        'relative flex cursor-pointer items-center gap-3 transition-colors duration-(--duration-fast) focus-visible:outline-offset-2 data-disabled:cursor-not-allowed data-disabled:bg-muted data-disabled:text-faint-foreground forced-colors:data-checked:outline-2 forced-colors:data-checked:outline-solid',
        LOOK[look],
        className,
      )}
      {...props}
    />
  )
}
