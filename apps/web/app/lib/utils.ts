import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge must know the token utilities from @splitune/ui-tokens/theme.tailwind.css, or it
// treats `text-read-tab` (a size) and `text-foreground` (a colour) as the same group and drops one.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        'target-min',
        'target-sm',
        'target',
        'target-practice-2',
        'target-practice',
        'control',
      ],
      shadow: ['1', '2', '3'],
      text: [
        'read-tab',
        'read-chord-current',
        'read-chord',
        'read-bar-number',
        'read-readout',
        'read-label',
      ],
      font: ['reading'],
      ease: ['standard', 'enter', 'exit'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
