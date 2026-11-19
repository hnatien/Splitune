import type {
  ClipProgress,
  PracticeAttemptInput,
  PracticeSessionInput,
  ProgressOutput,
  ProgressSession,
} from '@splitune/contracts'
import type { z } from 'zod'

// Progress metrics (12 §5, 27 §3.5, §3.7.4, §5.5; s39): pure functions over GET /v1/progress.
// Every day is a local calendar day in `timeZone` (this runtime's zone when omitted), so a pass at
// 23:30 counts for that evening, not for the server's day. The retention metric is the speed of
// the first clean pass in the next session ("cold"), not minutes; nothing here counts streaks or
// missed days.

export type Progress = z.infer<typeof ProgressOutput>
export type Clip = z.infer<typeof ClipProgress>
export type Session = z.infer<typeof ProgressSession>

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/** The window the client asks for: 30 days of chart plus a day of slack for time zones. */
export const PROGRESS_DAYS = 31

const formatters = new Map<string, Intl.DateTimeFormat>()

/** The local day of `date` as "2026-11-19". */
export function dayKey(date: Date, timeZone?: string): string {
  const id = timeZone ?? ''
  let format = formatters.get(id)
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    })
    formatters.set(id, format)
  }
  const parts = format.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const keyMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Whole local days from `then` to `now` (0 = the same day, 1 = yesterday). */
export function daysAgo(then: Date, now: Date, timeZone?: string): number {
  return Math.round((keyMs(dayKey(now, timeZone)) - keyMs(dayKey(then, timeZone))) / DAY_MS)
}

/** The last `n` local days, oldest first, ending today. */
export function lastDays(now: Date, n: number, timeZone?: string): string[] {
  const today = keyMs(dayKey(now, timeZone))
  return Array.from({ length: n }, (_, i) => keyOf(today - (n - 1 - i) * DAY_MS))
}

/** "M" for a Monday: the narrow weekday of a day key. */
export function weekdayLetter(key: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' }).format(keyMs(key))
}

export type SessionStats = {
  id: string
  songId: string
  startedAt: Date
  day: string
  minutes: number
  passes: number
  clean: number
}

/**
 * Sessions oldest first with their minutes: start to end, or to their last pass when the end
 * never arrived (a closed tab), or to `now` for the session open on this screen.
 */
export function sessionStats(
  progress: Progress,
  options: { now?: Date; openSessionId?: string | undefined; timeZone?: string } = {},
): SessionStats[] {
  const lastPass = new Map<string, number>()
  for (const clip of progress.clips) {
    for (const a of clip.attempts) {
      const at = Date.parse(a.at)
      lastPass.set(a.client_session_id, Math.max(lastPass.get(a.client_session_id) ?? 0, at))
    }
  }
  return progress.sessions
    .map((s) => {
      const start = Date.parse(s.started_at)
      const end =
        s.ended_at !== null
          ? Date.parse(s.ended_at)
          : s.client_session_id === options.openSessionId && options.now
            ? options.now.getTime()
            : (lastPass.get(s.client_session_id) ?? start)
      const startedAt = new Date(start)
      return {
        id: s.client_session_id,
        songId: s.song_id,
        startedAt,
        day: dayKey(startedAt, options.timeZone),
        minutes: Math.max(0, (end - start) / MINUTE_MS),
        passes: s.passes,
        clean: s.clean_passes,
      }
    })
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
}

export type ClipSession = {
  session: SessionStats
  passes: number
  clean: number
  /** The fastest clean pass of the session. */
  best: number | null
  /** The first clean pass of the session: the cold one, what stuck. */
  cold: number | null
}

/** The clip's passes grouped by session, oldest first; sessions without its passes are left out. */
export function clipSessions(clip: Clip, sessions: SessionStats[]): ClipSession[] {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const grouped = new Map<string, ClipSession>()
  for (const a of clip.attempts) {
    const session = byId.get(a.client_session_id)
    if (!session) continue
    let entry = grouped.get(session.id)
    if (!entry) {
      entry = { session, passes: 0, clean: 0, best: null, cold: null }
      grouped.set(session.id, entry)
    }
    entry.passes += 1
    if (a.outcome !== 'clean') continue
    entry.clean += 1
    entry.best = Math.max(entry.best ?? 0, a.tempo_pct)
    entry.cold ??= a.tempo_pct
  }
  return [...grouped.values()].sort(
    (a, b) => a.session.startedAt.getTime() - b.session.startedAt.getTime(),
  )
}

export type ChartPoint = { at: Date; best: number; cold: number }

/** The Last 30 days chart: one point per session with a clean pass, from 29 days ago to today. */
export function chartPoints(
  sessions: ClipSession[],
  now: Date,
  options: { days?: number; timeZone?: string } = {},
): ChartPoint[] {
  const days = options.days ?? 30
  return sessions.flatMap((s) =>
    s.best !== null && s.cold !== null && daysAgo(s.session.startedAt, now, options.timeZone) < days
      ? [{ at: s.session.startedAt, best: s.best, cold: s.cold }]
      : [],
  )
}

export type Trend =
  | { kind: 'one'; to: number }
  | { kind: 'rose' | 'went' | 'same'; from: number; to: number; sessions: number }

/** How a series moved, for the chart's text alternative ("rose from 60 to 80 over 9 sessions"). */
export function trend(values: number[]): Trend | null {
  const from = values[0]
  const to = values.at(-1)
  if (from === undefined || to === undefined) return null
  if (values.length === 1) return { kind: 'one', to }
  const kind = to > from ? 'rose' : to < from ? 'went' : 'same'
  return { kind, from, to, sessions: values.length }
}

export type Today = {
  /** The first clean pass of today's first session that has one. */
  cold: number | null
  clean: number
  passes: number
  /** Minutes of every session of the song today, with or without this clip. */
  minutes: number
}

export function todayStats(
  clip: ClipSession[],
  songSessions: SessionStats[],
  now: Date,
  timeZone?: string,
): Today {
  const today = dayKey(now, timeZone)
  const mine = clip.filter((s) => s.session.day === today)
  return {
    cold: mine.find((s) => s.cold !== null)?.cold ?? null,
    clean: mine.reduce((sum, s) => sum + s.clean, 0),
    passes: mine.reduce((sum, s) => sum + s.passes, 0),
    minutes: songSessions.filter((s) => s.day === today).reduce((sum, s) => sum + s.minutes, 0),
  }
}

export type Retention = { cold: number; previousBest: number; at: Date }

/**
 * The success metric (12 §5, 16): the first clean pass of the latest session that follows a
 * session on an earlier day, beside that earlier day's best. Null until a clip has been played
 * clean on two different days.
 */
export function nextSessionRetention(sessions: ClipSession[]): Retention | null {
  let result: Retention | null = null
  for (const [i, s] of sessions.entries()) {
    if (s.cold === null) continue
    const before = sessions
      .slice(0, i)
      .filter((p) => p.session.day < s.session.day && p.best !== null)
      .at(-1)
    if (before?.best != null) {
      result = { cold: s.cold, previousBest: before.best, at: s.session.startedAt }
    }
  }
  return result
}

/** The first clean pass of the clip's latest day that has one ("Yesterday's first clean pass"). */
export function latestFirstClean(sessions: ClipSession[]): { pct: number; at: Date } | null {
  const last = sessions.filter((s) => s.cold !== null).at(-1)
  if (!last || last.cold === null) return null
  const first = sessions.find((s) => s.session.day === last.session.day && s.cold !== null)
  return first?.cold != null ? { pct: first.cold, at: first.session.startedAt } : null
}

/** A practised day's dot is at least 0.45 opaque and full after half an hour (26 §12.2). */
export function dayDotOpacity(minutes: number): number {
  return minutes <= 0 ? 0 : Math.min(1, 0.45 + minutes / 60)
}

export type WeekDay = { key: string; letter: string; minutes: number }

export type Week = {
  days: WeekDay[]
  practisedDays: number
  minutes: number
  clean: number
  /** The clip whose best clean pass rose most this week. */
  gain: { clip: Clip; pct: number } | null
}

/**
 * This week (27 §3.5): the last seven local days by minutes (a day with a pass counts as at least
 * one minute), clean passes, and the clip that climbed most: its best clean pass of the seven days
 * against its best before them (or its first clean pass of the week when it is new).
 */
export function weekSummary(
  progress: Progress,
  sessions: SessionStats[],
  now: Date,
  timeZone?: string,
): Week {
  const keys = lastDays(now, 7, timeZone)
  const inWeek = sessions.filter((s) => keys.includes(s.day))
  const days = keys.map((key) => {
    const ofDay = inWeek.filter((s) => s.day === key)
    const minutes = ofDay.reduce((sum, s) => sum + s.minutes, 0)
    const passes = ofDay.reduce((sum, s) => sum + s.passes, 0)
    const practised = minutes >= 1 || passes > 0
    return { key, letter: weekdayLetter(key), minutes: practised ? Math.max(1, minutes) : 0 }
  })
  const first = keys[0] ?? ''
  let gain: Week['gain'] = null
  for (const clip of progress.clips) {
    const clean = clip.attempts.filter((a) => a.outcome === 'clean')
    const week = clean.filter((a) => dayKey(new Date(a.at), timeZone) >= first)
    if (week.length === 0) continue
    const before = clean.filter((a) => dayKey(new Date(a.at), timeZone) < first)
    const base =
      before.length > 0 ? Math.max(...before.map((a) => a.tempo_pct)) : (week[0]?.tempo_pct ?? 0)
    const pct = Math.max(...week.map((a) => a.tempo_pct)) - base
    if (pct > 0 && pct > (gain?.pct ?? 0)) gain = { clip, pct }
  }
  return {
    days,
    practisedDays: days.filter((d) => d.minutes > 0).length,
    minutes: inWeek.reduce((sum, s) => sum + s.minutes, 0),
    clean: inWeek.reduce((sum, s) => sum + s.clean, 0),
    gain,
  }
}

export type Revisit = { clip: Clip; daysAgo: number; best: number }

/** Worth a revisit (27 §3.5): clips with a best clean pass not played for 5 days or more, up to three, the most recent first. */
export function revisits(progress: Progress, now: Date, timeZone?: string): Revisit[] {
  return progress.clips
    .flatMap((clip) => {
      if (clip.best_clean_tempo_pct === null || clip.last_attempt_at === null) return []
      const ago = daysAgo(new Date(clip.last_attempt_at), now, timeZone)
      return ago >= 5 ? [{ clip, daysAgo: ago, best: clip.best_clean_tempo_pct }] : []
    })
    .sort((a, b) => a.daysAgo - b.daysAgo)
    .slice(0, 3)
}

/** The clip practised most recently (of one song, when given). */
export function latestClip(progress: Progress, songId?: string): Clip | null {
  let latest: Clip | null = null
  for (const clip of progress.clips) {
    if (songId !== undefined && clip.song_id !== songId) continue
    if (clip.last_attempt_at === null) continue
    if (!latest?.last_attempt_at || clip.last_attempt_at > latest.last_attempt_at) latest = clip
  }
  return latest
}

/**
 * The first session of today after a day away, and the clip that was hardest on the song's
 * previous practice day (most "Not yet", then the slowest best): the Warm up chip's target.
 */
export function warmUpClip(
  progress: Progress,
  sessions: SessionStats[],
  songId: string,
  now: Date,
  timeZone?: string,
): { clip: Clip; yesterday: boolean } | null {
  const today = dayKey(now, timeZone)
  const song = sessions.filter((s) => s.songId === songId)
  const previous = song.filter((s) => s.day < today).at(-1)
  if (song.filter((s) => s.day === today).length > 1 || !previous) return null
  const ids = new Set(song.filter((s) => s.day === previous.day).map((s) => s.id))
  let hardest: { clip: Clip; misses: number; best: number } | null = null
  for (const clip of progress.clips) {
    if (clip.song_id !== songId) continue
    const passes = clip.attempts.filter((a) => ids.has(a.client_session_id))
    const misses = passes.filter((a) => a.outcome === 'not_yet').length
    if (misses === 0) continue
    const best = Math.max(0, ...passes.filter((a) => a.outcome === 'clean').map((a) => a.tempo_pct))
    if (!hardest || misses > hardest.misses || (misses === hardest.misses && best < hardest.best)) {
      hardest = { clip, misses, best }
    }
  }
  return hardest
    ? { clip: hardest.clip, yesterday: daysAgo(previous.startedAt, now, timeZone) === 1 }
    : null
}

type PendingSession = z.infer<typeof PracticeSessionInput>
type PendingAttempt = z.infer<typeof PracticeAttemptInput>

/**
 * The server's progress with what this device hasn't sent yet (the practice outbox): offline
 * passes show at once. Sessions are matched by their client id; a pass on a clip the server's
 * answer doesn't know yet (made since it was fetched) brings its clip along.
 */
export function withPending(
  progress: Progress,
  pending: { sessions: PendingSession[]; attempts: PendingAttempt[] },
): Progress {
  if (pending.sessions.length === 0 && pending.attempts.length === 0) return progress
  const sessions = new Map(progress.sessions.map((s) => [s.client_session_id, { ...s }]))
  for (const s of pending.sessions) {
    const known = sessions.get(s.client_session_id)
    if (known) {
      known.ended_at ??= s.ended_at ?? null
      continue
    }
    sessions.set(s.client_session_id, {
      client_session_id: s.client_session_id,
      song_id: s.song_id,
      started_at: s.started_at,
      ended_at: s.ended_at ?? null,
      passes: 0,
      clean_passes: 0,
    })
  }
  const clips = new Map(
    progress.clips.map((c) => [c.loop_clip_id, { ...c, attempts: [...c.attempts] }]),
  )
  for (const a of pending.attempts) {
    const session = sessions.get(a.client_session_id)
    if (!session) continue
    session.passes += 1
    if (a.outcome === 'clean') session.clean_passes += 1
    if (!a.loop_clip_id) continue
    let clip = clips.get(a.loop_clip_id)
    if (!clip) {
      clip = {
        loop_clip_id: a.loop_clip_id,
        song_id: session.song_id,
        name: null,
        best_clean_tempo_pct: null,
        last_attempt_at: null,
        attempts: [],
      }
      clips.set(a.loop_clip_id, clip)
    }
    clip.attempts.push({
      at: a.at,
      tempo_pct: a.tempo_pct,
      outcome: a.outcome,
      client_session_id: a.client_session_id,
    })
    if (a.outcome === 'clean') {
      clip.best_clean_tempo_pct = Math.max(clip.best_clean_tempo_pct ?? 0, a.tempo_pct)
    }
    if (!clip.last_attempt_at || Date.parse(a.at) > Date.parse(clip.last_attempt_at)) {
      clip.last_attempt_at = a.at
    }
  }
  for (const clip of clips.values())
    clip.attempts.sort((x, y) => Date.parse(x.at) - Date.parse(y.at))
  return { clips: [...clips.values()], sessions: [...sessions.values()] }
}

/** Days practised in this calendar week (Monday first), for the optional Weekly goal. */
export function daysThisWeek(sessions: SessionStats[], now: Date, timeZone?: string): number {
  const today = keyMs(dayKey(now, timeZone))
  const monday = keyOf(today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS)
  return new Set(
    sessions.filter((s) => s.day >= monday && (s.minutes >= 1 || s.passes > 0)).map((s) => s.day),
  ).size
}
