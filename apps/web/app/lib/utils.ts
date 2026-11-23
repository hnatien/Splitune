import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge must know the token utilities from @splitune/ui-tokens/theme.tailwind.css, or it
// treats `text-read-tab` (a size) and `text-foreground` (a colour) as the same group and drops one.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [
        'target-min',
        'target',
        'target-practice',
        'target-play',
        'target-stand',
        'control',
      ],
      shadow: ['popover', 'dialog'],
      radius: ['media', 'field', 'panel', 'dialog'],
      text: [
        'kbd',
        'caption',
        'label-sm',
        'body-sm',
        'label',
        'body',
        'field',
        'title',
        'lead',
        'heading',
        'readout',
        'display',
        'hero',
        'read-tab',
        'read-chord-current',
        'read-chord-next',
        'read-chord-sheet',
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
