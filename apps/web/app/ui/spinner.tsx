import { Loader2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Decorative spinner; the busy state is announced by the control that owns it (aria-busy). */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden
      className={cn('size-5 animate-spin motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Spinner }
