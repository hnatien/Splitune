import type { LoopClip } from '@splitune/contracts'
import { ChevronRightIcon, HistoryIcon, TrendingUpIcon } from 'lucide-react'
import { useId } from 'react'
import type { z } from 'zod'
import { barNumber, formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { ProgressChart } from '@/ui/progress-chart'
import { Skeleton } from '@/ui/skeleton'
import { StatCard, StatCards } from '@/ui/stat-card'
import { Switch } from '@/ui/switch'
import { openSessionId } from './model/practice-sync'
import {
  type ClipSession,
  chartPoints,
  clipSessions,
  daysThisWeek,
  type Progress,
  type SessionStats,
  sessionStats,
  todayStats,
  warmUpClip,
} from './model/progress-metrics'
import { usePractice } from './practice-context'
import { chartLabel, formatPracticeTime, sessionDate } from './progress-copy'
import { useProgressData } from './progress-data'
import { useWeeklyGoal } from './progress-goal'

// The Progress tab (27 §3.7.4, Practice-Piano.dc.html; s39, lazy): the loop's clip ("Clip", its
// name, its bars), the Last 30 days chart (best clean pass solid, the first clean pass of each
// session dashed: what stuck), three stat cards, the Sessions rows, the Warm up chip on the first
// session after a day away, and the optional Weekly goal. With no loop, the song's clips with
// their best clean tempo; with no clean pass yet, the empty state (27 §4).

type Clip = z.infer<typeof LoopClip>

const heading = 'text-body-sm font-medium text-muted-foreground'

const bars = (clip: Clip) => `${barNumber(clip.start_bar)}–${barNumber(clip.end_bar)}`

const clipName = (clip: Clip) => clip.name ?? m['practice.loop_bars']({ bars: bars(clip) })

export function ProgressTab({ now = new Date() }: { now?: Date }) {
  const practice = usePractice()
  const { songId, clip, clips, guest, selectClip } = practice
  const { data, loading } = useProgressData({ enabled: !guest })
  if (loading) return <ProgressSkeleton />
  const sessions = sessionStats(data, { now, openSessionId: openSessionId() })
  const warm = warmUpClip(data, sessions, songId, now)
  const warmTarget = warm && clips.find((c) => c.id === warm.clip.loop_clip_id)
  return (
    <>
      {warmTarget && warmTarget.id !== clip?.id && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => selectClip(warmTarget, 'clip')}
        >
          <HistoryIcon aria-hidden />
          {warm.yesterday ? m['progress.warm_up']() : m['progress.warm_up_last']()}
        </Button>
      )}
      {clip ? (
        <ClipProgress clip={clip} data={data} sessions={sessions} songId={songId} now={now} />
      ) : (
        <SongClips clips={clips} onPick={(c) => selectClip(c, 'clip')} />
      )}
      <WeeklyGoal sessions={sessions} now={now} />
    </>
  )
}

function ProgressSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <TrendingUpIcon aria-hidden strokeWidth={1.8} className="size-7 text-faint-foreground" />
      <p className="text-label text-muted-foreground">{m['practice.progress_empty']()}</p>
    </div>
  )
}

function ClipProgress({
  clip,
  data,
  sessions,
  songId,
  now,
}: {
  clip: Clip
  data: Progress
  sessions: SessionStats[]
  songId: string
  now: Date
}) {
  const progress = data.clips.find((c) => c.loop_clip_id === clip.id)
  const bySession = progress ? clipSessions(progress, sessions) : []
  const points = chartPoints(bySession, now)
  const songSessions = sessions.filter((s) => s.songId === songId)
  const today = todayStats(bySession, songSessions, now)
  const start = new Date(now.getTime() - 29 * 86_400_000)
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className={heading}>{m['progress.clip']()}</span>
        <h2 className="text-heading">{clipName(clip)}</h2>
        {clip.name !== null && (
          <p className="text-body-sm text-faint-foreground">
            {m['progress.bars']({ bars: bars(clip) })}
          </p>
        )}
      </div>
      {bySession.length === 0 ? (
        <Empty />
      ) : (
        <>
          <section
            aria-labelledby="progress-30"
            className="flex flex-col gap-2.5 rounded-field border border-border p-3.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="progress-30" className="text-label">
                {m['progress.last_30_days']()}
              </h3>
              <span className="text-body-sm text-faint-foreground">
                {m['progress.clean_speed']()}
              </span>
            </div>
            {points.length > 0 ? (
              <ProgressChart
                points={points}
                domain={[start, now]}
                label={chartLabel(points)}
                legend={{ best: m['progress.legend_best'](), cold: m['progress.legend_cold']() }}
              />
            ) : (
              <p className="text-body-sm text-muted-foreground">{m['practice.progress_empty']()}</p>
            )}
          </section>
          <StatCards>
            <StatCard
              value={today.cold === null ? '–' : formatPercent(today.cold)}
              label={m['progress.cold_today']()}
            />
            <StatCard
              value={`${today.clean} / ${today.passes}`}
              label={m['progress.clean_passes']()}
            />
            <StatCard value={formatPracticeTime(today.minutes)} label={m['progress.today']()} />
          </StatCards>
          <SessionList sessions={bySession} now={now} />
        </>
      )}
    </>
  )
}

/** 26 §12.2 SessionList: newest first, "Today · 18 min · 14 passes · best 60 %". */
function SessionList({ sessions, now }: { sessions: ClipSession[]; now: Date }) {
  return (
    <section aria-labelledby="progress-sessions" className="flex flex-col">
      <h3 id="progress-sessions" className={`${heading} mb-1.5`}>
        {m['progress.sessions']()}
      </h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {[...sessions].reverse().map((s) => {
          const minutes = formatPracticeTime(s.session.minutes)
          return (
            <li key={s.session.id} className="flex items-baseline gap-2.5 py-1.5 text-body-sm">
              <span className="w-24 shrink-0">{sessionDate(s.session.startedAt, now)}</span>
              <span className="min-w-0 flex-1 text-faint-foreground tabular-nums">
                {s.passes === 1
                  ? m['progress.session_meta_one']({ minutes })
                  : m['progress.session_meta']({ minutes, passes: String(s.passes) })}
              </span>
              <span className="text-right tabular-nums">
                {s.best === null
                  ? m['progress.no_clean']()
                  : m['progress.clip_best']({ pct: formatPercent(s.best) })}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** No loop: the song's clips with their best clean tempo; a row loops it. */
function SongClips({ clips, onPick }: { clips: Clip[]; onPick: (clip: Clip) => void }) {
  if (clips.length === 0) return <Empty />
  return (
    <section aria-labelledby="progress-clips" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id="progress-clips" className="text-heading">
          {m['progress.clips']()}
        </h2>
        <p className="text-body-sm text-muted-foreground">{m['progress.clips_hint']()}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {clips.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex min-h-target-practice w-full items-center gap-3 rounded-field px-2 text-left transition-colors duration-(--duration-fast) hover:bg-panel focus-visible:outline-offset-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label">{clipName(c)}</span>
                {c.name !== null && (
                  <span className="block text-body-sm text-faint-foreground">
                    {m['progress.bars']({ bars: bars(c) })}
                  </span>
                )}
              </span>
              <span className="text-body-sm tabular-nums text-muted-foreground">
                {c.best_clean_tempo_pct === null
                  ? m['progress.no_clean']()
                  : m['progress.clip_best']({ pct: formatPercent(c.best_clean_tempo_pct) })}
              </span>
              <ChevronRightIcon aria-hidden className="size-4 text-faint-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Weekly goal (27 §3.7.4, §5.5): off by default, days a week, on this device; no reminders. */
function WeeklyGoal({ sessions, now }: { sessions: SessionStats[]; now: Date }) {
  const id = useId()
  const daysId = useId()
  const { on, days, setOn, setDays } = useWeeklyGoal()
  return (
    <section className="mt-auto flex flex-col gap-3 border-t border-border pt-3.5">
      <div className="flex min-h-target-practice items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <Label htmlFor={id}>{m['progress.weekly_goal']()}</Label>
          <span className="text-body-sm text-faint-foreground">
            {m['progress.weekly_goal_hint']()}
          </span>
        </span>
        <Switch id={id} checked={on} onCheckedChange={setOn} />
      </div>
      {on && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor={daysId}>{m['progress.goal_days']()}</Label>
          <NumberField
            id={daysId}
            value={days}
            min={1}
            max={7}
            step={1}
            decrementLabel={m['progress.goal_fewer']()}
            incrementLabel={m['progress.goal_more']()}
            onValueChange={(next) => next !== null && setDays(next)}
          />
          <p role="status" className="basis-full text-body-sm text-muted-foreground tabular-nums">
            {m['progress.goal_status']({
              n: String(Math.min(days, daysThisWeek(sessions, now))),
              goal: String(days),
            })}
          </p>
        </div>
      )}
    </section>
  )
}
