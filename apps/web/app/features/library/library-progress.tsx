import type { LibrarySong, LoopClip } from '@splitune/contracts'
import { useQueries } from '@tanstack/react-query'
import type * as React from 'react'
import type { z } from 'zod'
import { orpc } from '@/lib/api'
import { barNumber, formatPercent, formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Sparkline } from '@/ui/sparkline'
import { openSessionId } from '../practice/model/practice-sync'
import {
  chartPoints,
  clipSessions,
  daysAgo,
  latestClip,
  latestFirstClean,
  type Clip as ProgressClip,
  revisits,
  sessionStats,
  weekSummary,
} from '../practice/model/progress-metrics'
import { bestTrendLabel, formatPracticeTime } from '../practice/progress-copy'
import { useProgressData } from '../practice/progress-data'
import type { ContinueSummary } from './continue-card'
import type { RevisitClip } from './revisit-list'
import type { WeekDay } from './week-strip'

// The library's progress (27 §3.5, §5.5; s39): the Continue card's clip, badges and 30-day
// sparkline, This week and Worth a revisit, from the progress the Progress tab uses (GET
// /v1/progress plus passes not sent yet). Clip bars and ladders come from each song's loop list,
// revisit titles from the song; only the songs these strips name are asked for.

type Song = z.infer<typeof LibrarySong>
type Loop = z.infer<typeof LoopClip>

const bars = (loop: Loop) => `${barNumber(loop.start_bar)}–${barNumber(loop.end_bar)}`

/** The clip's name, or its bars when it was never named ("Bars 25–28"). */
const clipLabel = (clip: ProgressClip, loop: Loop | undefined) =>
  clip.name ?? (loop ? m['practice.loop_bars']({ bars: bars(loop) }) : null)

function firstCleanBadge(first: { pct: number; at: Date }, now: Date): string {
  const pct = formatPercent(first.pct)
  const ago = daysAgo(first.at, now)
  if (ago === 0) return m['library.first_clean_today']({ pct })
  if (ago === 1) return m['library.first_clean_yesterday']({ pct })
  return m['library.first_clean_ago']({ when: formatRelativeDate(first.at, now), pct })
}

/** Before any progress (27 §3.5): the song, its part and its best clean tempo from the list. */
function songSummary(song: Song): ContinueSummary {
  const best = song.best_clean
  const meta = [
    song.artist,
    instrumentLabel(song.instrument),
    best &&
      m['library.bars']({
        start: String(barNumber(best.start_bar)),
        end: String(barNumber(best.end_bar)),
      }),
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    title: song.title,
    meta,
    compact: meta,
    when: formatRelativeDate(new Date(song.last_opened_at ?? song.created_at)),
    badges: best
      ? [
          {
            label: m['library.best_clean']({ pct: formatPercent(best.tempo_pct) }),
            variant: 'neutral',
          },
        ]
      : [],
  }
}

export type LibraryProgress = {
  continueCard: (song: Song) => { summary: ContinueSummary; chart: React.ReactNode }
  week: { days: WeekDay[]; total: string; stats: { value: string; label: string }[] } | null
  revisit: (RevisitClip & { songId: string; loop: string })[]
}

export function useLibraryProgress(last: Song | undefined, now = new Date()): LibraryProgress {
  const { data } = useProgressData()
  const sessions = sessionStats(data, { now, openSessionId: openSessionId() })
  const week = weekSummary(data, sessions, now)
  const toRevisit = revisits(data, now)
  const current = last ? latestClip(data, last.id) : null
  const songIds = [
    ...new Set(
      [last?.id, week.gain?.clip.song_id, ...toRevisit.map((r) => r.clip.song_id)].filter(
        (id): id is string => id !== undefined,
      ),
    ),
  ]
  const loopLists = useQueries({
    queries: songIds.map((id) => orpc.loops.list.queryOptions({ input: { id } })),
  })
  const loops = new Map(
    loopLists.flatMap((list) => list.data?.items ?? []).map((loop) => [loop.id, loop]),
  )
  const revisitSongIds = [...new Set(toRevisit.map((r) => r.clip.song_id))]
  const details = useQueries({
    queries: revisitSongIds.map((id) => orpc.songs.get.queryOptions({ input: { id } })),
  })
  const songs = new Map(details.flatMap((d) => (d.data ? [[d.data.id, d.data] as const] : [])))

  const continueCard = (song: Song) => {
    const loop = current ? loops.get(current.loop_clip_id) : undefined
    if (!current || !loop) return { summary: songSummary(song), chart: null }
    const bySession = clipSessions(current, sessions)
    const points = chartPoints(bySession, now)
    const label = clipLabel(current, loop)
    const range = m['library.bars']({
      start: String(barNumber(loop.start_bar)),
      end: String(barNumber(loop.end_bar)),
    })
    const clipMeta =
      current.name === null ? (
        range
      ) : (
        <>
          {m['library.clip']()} <strong className="font-medium text-foreground">{label}</strong>,{' '}
          {range}
        </>
      )
    const lastSession = sessions.filter((s) => s.songId === song.id).at(-1)
    const ladder = loop.trainer
    const ladderPct = ladder?.current_pct ?? ladder?.start_pct
    const first = latestFirstClean(bySession)
    const best = current.best_clean_tempo_pct
    const badges: ContinueSummary['badges'] = [
      ...(ladder && ladderPct !== undefined
        ? [
            {
              label: m['library.ladder_at']({
                current: formatPercent(ladderPct),
                goal: formatPercent(ladder.end_pct),
              }),
              variant: 'primary' as const,
            },
          ]
        : []),
      ...(best === null
        ? []
        : [
            {
              label: m['library.best_clean']({ pct: formatPercent(best) }),
              variant: 'neutral' as const,
            },
          ]),
      ...(first ? [{ label: firstCleanBadge(first, now), variant: 'neutral' as const }] : []),
    ]
    const head = [song.artist, instrumentLabel(song.instrument)].filter(Boolean).join(' · ')
    return {
      summary: {
        title: song.title,
        meta: (
          <>
            {head} · {clipMeta}
          </>
        ),
        compact: [
          current.name ?? range,
          current.name === null ? null : range,
          ladder && ladderPct !== undefined
            ? m['library.ladder_short']({ pct: formatPercent(ladderPct) })
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        when: lastSession
          ? m['library.when_minutes']({
              when: formatRelativeDate(lastSession.startedAt, now),
              minutes: formatPracticeTime(lastSession.minutes),
            })
          : formatRelativeDate(new Date(song.last_opened_at ?? song.created_at), now),
        badges,
      },
      chart:
        points.length > 0 ? (
          <Sparkline
            values={points.map((p) => ({ at: p.at, value: p.best }))}
            domain={[new Date(now.getTime() - 29 * 86_400_000), now]}
            label={bestTrendLabel(points.map((p) => p.best))}
          />
        ) : null,
    }
  }

  const gainLabel = week.gain && clipLabel(week.gain.clip, loops.get(week.gain.clip.loop_clip_id))
  const total = formatPracticeTime(week.minutes)

  return {
    continueCard,
    // Nothing practised in the last seven days: no strip at all, never a row of empty days.
    week:
      week.practisedDays === 0
        ? null
        : {
            days: week.days.map((d) => ({ letter: d.letter, minutes: d.minutes })),
            total,
            stats: [
              { value: total, label: m['library.week_practised']() },
              { value: String(week.clean), label: m['library.week_clean']() },
              ...(week.gain && gainLabel
                ? [
                    {
                      value: `+${formatPercent(week.gain.pct)}`,
                      label: m['library.week_gain']({ clip: gainLabel }),
                    },
                  ]
                : []),
            ],
          },
    revisit: toRevisit.flatMap((r) => {
      const loop = loops.get(r.clip.loop_clip_id)
      const song = songs.get(r.clip.song_id)
      const label = clipLabel(r.clip, loop)
      if (!loop || !song || !label) return []
      return [
        {
          id: r.clip.loop_clip_id,
          songId: song.id,
          loop: `${barNumber(loop.start_bar)}-${barNumber(loop.end_bar)}`,
          instrument: song.instrument,
          clip: label,
          meta: m['library.revisit_meta']({
            song: song.title,
            when: formatRelativeDate(new Date(r.clip.last_attempt_at ?? 0), now),
            pct: formatPercent(r.best),
          }),
        },
      ]
    }),
  }
}
