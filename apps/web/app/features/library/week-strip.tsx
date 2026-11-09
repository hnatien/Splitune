import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type WeekDay = {
  /** "M" */
  letter: string
  minutes: number
}

// "This week" (27 §3.5, §5.5, 26 §12.2 WeekStrip): seven day dots, filled --signal with an opacity
// that grows with the minutes practised (at least 0.45) or outlined --input when not practised;
// never a streak count or a missed day. Built with fixture data; s39 feeds it.
function Dot({ day, size }: { day: WeekDay; size: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full',
        size === 'md' ? 'size-7.5' : 'size-5.5',
        day.minutes === 0 ? 'border-2 border-input' : 'bg-signal',
      )}
      style={day.minutes === 0 ? undefined : { opacity: Math.min(1, 0.45 + day.minutes / 60) }}
    />
  )
}

const practisedOn = (days: WeekDay[]) =>
  m['library.week_label']({ n: String(days.filter((day) => day.minutes > 0).length) })

export function WeekStrip({
  days,
  stats,
  className,
}: {
  days: WeekDay[]
  /** Three mono figures: "1 h 20" practised, "23" clean passes, "+10 %" on {clip}. */
  stats: { value: string; label: string }[]
  className?: string
}) {
  return (
    <section
      data-slot="week-strip"
      aria-labelledby="this-week"
      className={cn(
        'flex min-w-0 flex-col gap-3.5 rounded-3xl border border-border bg-card p-5',
        className,
      )}
    >
      <h2 id="this-week" className="text-xs tracking-[0.08em] text-faint-foreground uppercase">
        {m['library.this_week']()}
      </h2>
      <div
        role="img"
        aria-label={practisedOn(days)}
        className="grid grid-cols-7 gap-1.5 text-center"
      >
        {days.map((day, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the seven days are positional
          <span key={index} className="flex flex-col items-center gap-1.5">
            <Dot day={day} size="md" />
            <span className="text-sm text-faint-foreground">{day.letter}</span>
          </span>
        ))}
      </div>
      <dl className="flex gap-4.5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse">
            <dt className="text-sm text-faint-foreground">{stat.label}</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Phone: "This week" · seven 22 px dots · the total time. */
export function WeekStripCompact({ days, total }: { days: WeekDay[]; total: string }) {
  return (
    <div data-slot="week-strip" className="flex items-center gap-3">
      <span className="w-18.5 text-sm text-faint-foreground">{m['library.this_week']()}</span>
      <span role="img" aria-label={practisedOn(days)} className="flex flex-1 gap-2">
        {days.map((day, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the seven days are positional
          <Dot key={index} day={day} size="sm" />
        ))}
      </span>
      <span className="font-mono text-sm text-muted-foreground tabular-nums">{total}</span>
    </div>
  )
}
