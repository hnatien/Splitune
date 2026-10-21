import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'

// First focus stop on every page (WCAG 2.4.1): jumps past the header to the page's <main>.
export function SkipLink() {
  return (
    <a
      href="#main"
      className={cn(
        buttonVariants({ variant: 'primary' }),
        'absolute top-2 left-2 z-(--z-toast) -translate-y-24 focus-visible:translate-y-0',
      )}
    >
      {m['nav.skip_to_content']()}
    </a>
  )
}
