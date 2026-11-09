import { TrendingUpIcon } from 'lucide-react'
import { m } from '@/lib/i18n'

// The Progress tab (27 §3.7.4, §4): until s39 brings the pass history, its empty state.
export function ProgressTab() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border-strong px-6 py-8 text-center">
      <TrendingUpIcon aria-hidden strokeWidth={1.8} className="size-7 text-faint-foreground" />
      <p className="text-md text-muted-foreground">{m['practice.progress_empty']()}</p>
    </div>
  )
}
