import { Skeleton } from '@/ui/skeleton'
import { FocusShell } from '../shell/focus-shell'

// Practice loading state (27 §4): the regions as skeletons. Its own module (route pending
// components are not code-split).
export function PracticeLoading() {
  return (
    <FocusShell>
      <div aria-busy="true" className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </FocusShell>
  )
}
