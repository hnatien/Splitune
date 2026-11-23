import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Stat, Stats } from '@/ui/stat'

export type WeekDay = {
  /** "M" */
  letter: string
  minutes: number
}

const practisedOn = (days: WeekDay[]) =>
  m['library.week_label']({ n: String(days.filter((day) => day.minutes > 0).length) })

// "This week" (27 §3.5, §5.5): the week's figures (time practised, clean passes, the biggest gain)
// over seven day columns. A practised day is an ink bar whose height grows with its minutes (at
// least a quarter, so a short day still shows); a day without practice is a short --edge dash.
// Height carries the amount, not lightness, and there is never a streak count or a missed day.
// Fed by the progress data (s39, library-progress.tsx).
export function WeekStrip({
  days,
  stats,
  className,
}: {
  days: WeekDay[]
  /** Up to three figures: "1 h 20" practised, "23" clean passes, "+10 %" on {clip}. */
  stats: { value: string; label: string }[]
  className?: string
}) {
  const most = Math.max(1, ...days.map((day) => day.minutes))
  return (
    <section
      data-slot="week-strip"
      aria-labelledby="this-week"
      className={cn('flex min-w-0 flex-col gap-4', className)}
    >
      <h2 id="this-week" className="text-label-sm text-muted-foreground">
        {m['library.this_week']()}
      </h2>
      <Stats>
        {stats.map((stat) => (
          <Stat key={stat.label} value={stat.value} label={stat.label} />
        ))}
      </Stats>
      <div role="img" aria-label={practisedOn(days)} className="flex gap-2">
        {days.map((day, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the seven days are positional
          <span key={index} className="flex w-6 flex-col items-center gap-1.5">
            <span className="flex h-8 w-full items-end justify-center">
              {day.minutes > 0 ? (
                <span
                  data-minutes={day.minutes}
                  className="w-2 rounded-full bg-foreground"
                  style={{ height: `${Math.max(25, (day.minutes / most) * 100)}%` }}
                />
              ) : (
                <span className="h-0.5 w-2 rounded-full bg-edge" />
              )}
            </span>
            <span className="text-caption text-muted-foreground">{day.letter}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
