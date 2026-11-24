import type { LoopClip } from '@splitune/contracts'
import { HistoryIcon, TrendingUpIcon } from 'lucide-react'
import { useId } from 'react'
import type { z } from 'zod'
import { barNumber, formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { ListRow } from '@/ui/list-row'
import { NumberField } from '@/ui/number-field'
import { PanelSection } from '@/ui/panel'
import { ProgressChart } from '@/ui/progress-chart'
import { Skeleton } from '@/ui/skeleton'
import { Stat, Stats } from '@/ui/stat'
import { SwitchRow } from '../common/switch-row'
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

// The Progress tab (27 §3.7.4; s39, lazy; s47 direction §6): the loop's clip (its name and bars),
// today in three figures (first clean pass, clean passes of passes, minutes: `Stat`s, no cards),
// the Last 30 days chart (best clean pass solid with circles, the first clean pass of each session
// dashed with squares: what stuck, never colour alone), the sessions as hairline rows, the Warm up
// action on the first session after a day away, and the optional Weekly goal. With no loop, the
// song's clips as rows with their best clean tempo; with no clean pass yet, the empty state
// (27 §4). Sections are divided by hairlines inside the one panel; nothing is boxed.

type Clip = z.infer<typeof LoopClip>

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
    <div data-slot="progress-tab" className="flex flex-col [&>section:first-child]:pt-0">
      {warmTarget && warmTarget.id !== clip?.id && (
        <PanelSection>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => selectClip(warmTarget, 'clip')}
          >
            <HistoryIcon aria-hidden />
            {warm.yesterday ? m['progress.warm_up']() : m['progress.warm_up_last']()}
          </Button>
        </PanelSection>
      )}
      {clip ? (
        <ClipProgress clip={clip} data={data} sessions={sessions} songId={songId} now={now} />
      ) : (
        <SongClips clips={clips} onPick={(c) => selectClip(c, 'clip')} />
      )}
      <WeeklyGoal sessions={sessions} now={now} />
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <div className="flex gap-8">
        <Skeleton className="h-12 w-16" />
        <Skeleton className="h-12 w-16" />
        <Skeleton className="h-12 w-16" />
      </div>
      <Skeleton className="h-36 w-full" />
    </div>
  )
}

/** The empty state (26 §13): an icon, a line and what to do, no box. */
function Empty() {
  return (
    <div data-slot="progress-empty" className="flex flex-col items-start gap-2 py-2">
      <TrendingUpIcon aria-hidden strokeWidth={1.8} className="size-6 text-muted-foreground" />
      <p className="text-body-sm text-muted-foreground">{m['practice.progress_empty']()}</p>
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
  const chartId = useId()
  const progress = data.clips.find((c) => c.loop_clip_id === clip.id)
  const bySession = progress ? clipSessions(progress, sessions) : []
  const points = chartPoints(bySession, now)
  const songSessions = sessions.filter((s) => s.songId === songId)
  const today = todayStats(bySession, songSessions, now)
  const start = new Date(now.getTime() - 29 * 86_400_000)
  return (
    <>
      <PanelSection data-slot="progress-clip" className="gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-label-sm text-muted-foreground">{m['progress.clip']()}</span>
          <h2 className="text-title">{clipName(clip)}</h2>
          {clip.name !== null && (
            <p className="text-body-sm text-muted-foreground tabular-nums">
              {m['progress.bars']({ bars: bars(clip) })}
            </p>
          )}
        </div>
        {bySession.length === 0 ? (
          <Empty />
        ) : (
          <Stats role="group" aria-label={m['progress.today']()} className="gap-x-6">
            <Stat
              value={today.cold === null ? '–' : formatPercent(today.cold)}
              label={m['progress.cold_today']()}
            />
            <Stat value={`${today.clean} / ${today.passes}`} label={m['progress.clean_passes']()} />
            <Stat value={formatPracticeTime(today.minutes)} label={m['progress.today']()} />
          </Stats>
        )}
      </PanelSection>
      {bySession.length > 0 && (
        <>
          <PanelSection
            aria-labelledby={chartId}
            title={<span id={chartId}>{m['progress.last_30_days']()}</span>}
            action={
              <span className="text-caption text-muted-foreground">
                {m['progress.clean_speed']()}
              </span>
            }
          >
            {points.length > 0 ? (
              <ProgressChart
                points={points}
                domain={[start, now]}
                label={chartLabel(points)}
                legend={{ best: m['progress.legend_best'](), cold: m['progress.legend_cold']() }}
              />
            ) : (
              <Empty />
            )}
          </PanelSection>
          <SessionList sessions={bySession} now={now} />
        </>
      )}
    </>
  )
}

/** 26 §12.2 SessionList: newest first, "Today · 18 min · 7 passes" and the session's best. */
function SessionList({ sessions, now }: { sessions: ClipSession[]; now: Date }) {
  const titleId = useId()
  return (
    <PanelSection
      aria-labelledby={titleId}
      title={<span id={titleId}>{m['progress.sessions']()}</span>}
      className="gap-1"
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {[...sessions].reverse().map((s) => {
          const minutes = formatPracticeTime(s.session.minutes)
          return (
            <ListRow
              key={s.session.id}
              data-slot="session-row"
              className="min-h-12 px-0 last:border-b-0 hover:bg-transparent"
              title={sessionDate(s.session.startedAt, now)}
              meta={
                s.passes === 1
                  ? m['progress.session_meta_one']({ minutes })
                  : m['progress.session_meta']({ minutes, passes: String(s.passes) })
              }
              aside={
                <span className="text-body-sm text-foreground tabular-nums">
                  {s.best === null
                    ? m['progress.no_clean']()
                    : m['progress.clip_best']({ pct: formatPercent(s.best) })}
                </span>
              }
            />
          )
        })}
      </ul>
    </PanelSection>
  )
}

/** No loop: the song's clips with their best clean tempo; a row loops it. */
function SongClips({ clips, onPick }: { clips: Clip[]; onPick: (clip: Clip) => void }) {
  const titleId = useId()
  if (clips.length === 0) {
    return (
      <PanelSection>
        <Empty />
      </PanelSection>
    )
  }
  return (
    <PanelSection aria-labelledby={titleId} className="gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id={titleId} className="text-title">
          {m['progress.clips']()}
        </h2>
        <p className="text-body-sm text-muted-foreground">{m['progress.clips_hint']()}</p>
      </div>
      <ul className="m-0 flex list-none flex-col border-t border-border p-0">
        {clips.map((c) => (
          <ListRow
            key={c.id}
            className="min-h-target-practice px-0 pl-2"
            title={clipName(c)}
            meta={c.name !== null ? m['progress.bars']({ bars: bars(c) }) : undefined}
            render={<button type="button" className="text-left" onClick={() => onPick(c)} />}
            aside={
              <span className="pr-2 text-body-sm text-muted-foreground tabular-nums">
                {c.best_clean_tempo_pct === null
                  ? m['progress.no_clean']()
                  : m['progress.clip_best']({ pct: formatPercent(c.best_clean_tempo_pct) })}
              </span>
            }
          />
        ))}
      </ul>
    </PanelSection>
  )
}

/** Weekly goal (27 §3.7.4, §5.5): off by default, days a week, on this device; no reminders. */
function WeeklyGoal({ sessions, now }: { sessions: SessionStats[]; now: Date }) {
  const daysId = useId()
  const { on, days, setOn, setDays } = useWeeklyGoal()
  return (
    <PanelSection className="gap-2">
      <SwitchRow
        label={m['progress.weekly_goal']()}
        hint={m['progress.weekly_goal_hint']()}
        checked={on}
        onCheckedChange={setOn}
      />
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
    </PanelSection>
  )
}
