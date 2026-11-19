import { describe, expect, it } from 'vitest'
import {
  type Clip,
  chartPoints,
  clipSessions,
  dayDotOpacity,
  dayKey,
  daysAgo,
  daysThisWeek,
  lastDays,
  latestClip,
  latestFirstClean,
  nextSessionRetention,
  type Progress,
  revisits,
  type Session,
  sessionStats,
  todayStats,
  trend,
  warmUpClip,
  weekSummary,
  withPending,
} from './progress-metrics'

const SONG = '00000000-0000-4000-8000-0000000000a1'
const OTHER_SONG = '00000000-0000-4000-8000-0000000000a2'
const CLIP = '00000000-0000-4000-8000-0000000000c1'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const UTC = 'UTC'
// Thursday 19 Nov 2026, 15:00 UTC.
const NOW = new Date('2026-11-19T15:00:00Z')

const session = (n: number, start: string, end: string | null, extra: Partial<Session> = {}) =>
  ({
    client_session_id: id(n),
    song_id: SONG,
    started_at: start,
    ended_at: end,
    passes: 0,
    clean_passes: 0,
    ...extra,
  }) satisfies Session

const pass = (n: number, at: string, tempo: number, clean = true) => ({
  at,
  tempo_pct: tempo,
  outcome: clean ? ('clean' as const) : ('not_yet' as const),
  client_session_id: id(n),
})

const clip = (attempts: Clip['attempts'], extra: Partial<Clip> = {}): Clip => ({
  loop_clip_id: CLIP,
  song_id: SONG,
  name: 'Chorus riff',
  best_clean_tempo_pct:
    Math.max(0, ...attempts.filter((a) => a.outcome === 'clean').map((a) => a.tempo_pct)) || null,
  last_attempt_at: attempts.at(-1)?.at ?? null,
  attempts,
  ...extra,
})

describe('days', () => {
  it('reads the local day in the given time zone', () => {
    const late = new Date('2026-11-19T23:30:00Z')
    expect(dayKey(late, UTC)).toBe('2026-11-19')
    expect(dayKey(late, 'Pacific/Auckland')).toBe('2026-11-20')
    expect(dayKey(late, 'America/Los_Angeles')).toBe('2026-11-19')
    expect(dayKey(new Date('2026-11-20T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-19')
  })

  it('counts calendar days, not 24-hour spans', () => {
    // 23:50 yesterday is one day ago at 00:10 today.
    expect(daysAgo(new Date('2026-11-18T23:50:00Z'), new Date('2026-11-19T00:10:00Z'), UTC)).toBe(1)
    expect(daysAgo(new Date('2026-11-19T00:01:00Z'), new Date('2026-11-19T23:59:00Z'), UTC)).toBe(0)
    // Across the end of daylight saving time in Europe (25 Oct 2026).
    const berlin = 'Europe/Berlin'
    expect(
      daysAgo(new Date('2026-10-24T22:30:00Z'), new Date('2026-10-26T08:00:00Z'), berlin),
    ).toBe(1)
  })

  it('lists the last days oldest first, across a month and a year', () => {
    expect(lastDays(new Date('2026-12-02T10:00:00Z'), 3, UTC)).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ])
    expect(lastDays(new Date('2027-01-01T10:00:00Z'), 2, UTC)).toEqual(['2026-12-31', '2027-01-01'])
  })
})

describe('sessions', () => {
  it('times a session by its end, its last pass, or now when it is open here', () => {
    const progress: Progress = {
      sessions: [
        session(1, '2026-11-18T10:00:00Z', '2026-11-18T10:18:00Z'),
        session(2, '2026-11-19T09:00:00Z', null),
        session(3, '2026-11-19T14:00:00Z', null),
        session(4, '2026-11-19T12:00:00Z', null),
      ],
      clips: [clip([pass(2, '2026-11-19T09:12:00Z', 60)])],
    }
    const stats = sessionStats(progress, { now: NOW, openSessionId: id(3), timeZone: UTC })
    expect(stats.map((s) => [s.id, Math.round(s.minutes)])).toEqual([
      [id(1), 18],
      [id(2), 12],
      [id(4), 0],
      [id(3), 60],
    ])
  })

  it('groups a clip by session with the best and the first clean pass', () => {
    const progress: Progress = {
      sessions: [
        session(1, '2026-11-17T10:00:00Z', '2026-11-17T10:20:00Z'),
        session(2, '2026-11-18T10:00:00Z', '2026-11-18T10:20:00Z'),
        session(3, '2026-11-19T10:00:00Z', '2026-11-19T10:20:00Z'),
      ],
      clips: [
        clip([
          pass(1, '2026-11-17T10:01:00Z', 60, false),
          pass(1, '2026-11-17T10:02:00Z', 60),
          pass(1, '2026-11-17T10:03:00Z', 70),
          pass(2, '2026-11-18T10:01:00Z', 65),
          pass(2, '2026-11-18T10:02:00Z', 75),
          pass(3, '2026-11-19T10:01:00Z', 70, false),
        ]),
      ],
    }
    const stats = sessionStats(progress, { timeZone: UTC })
    const grouped = clipSessions(progress.clips[0] as Clip, stats)
    expect(grouped.map((s) => [s.passes, s.clean, s.best, s.cold])).toEqual([
      [3, 2, 70, 60],
      [2, 2, 75, 65],
      [1, 0, null, null],
    ])
    expect(chartPoints(grouped, NOW, { timeZone: UTC })).toEqual([
      { at: new Date('2026-11-17T10:00:00Z'), best: 70, cold: 60 },
      { at: new Date('2026-11-18T10:00:00Z'), best: 75, cold: 65 },
    ])
    // The success metric: the second day's first clean pass against the first day's best.
    expect(nextSessionRetention(grouped)).toEqual({
      cold: 65,
      previousBest: 70,
      at: new Date('2026-11-18T10:00:00Z'),
    })
    expect(latestFirstClean(grouped)).toEqual({ pct: 65, at: new Date('2026-11-18T10:00:00Z') })
  })

  it('keeps the chart to the last 30 local days', () => {
    const sessions = [
      session(1, '2026-10-20T23:30:00Z', '2026-10-20T23:50:00Z'),
      session(2, '2026-10-21T00:30:00Z', '2026-10-21T00:50:00Z'),
    ]
    const progress: Progress = {
      sessions,
      clips: [clip([pass(1, '2026-10-20T23:31:00Z', 50), pass(2, '2026-10-21T00:31:00Z', 55)])],
    }
    const grouped = clipSessions(
      progress.clips[0] as Clip,
      sessionStats(progress, { timeZone: UTC }),
    )
    // 20 Oct is 30 days before 19 Nov, so only 21 Oct is inside "Last 30 days" in UTC; in Auckland
    // both passes fall on 21 Oct.
    expect(chartPoints(grouped, NOW, { timeZone: UTC }).map((p) => p.best)).toEqual([55])
    const auckland = clipSessions(
      progress.clips[0] as Clip,
      sessionStats(progress, { timeZone: 'Pacific/Auckland' }),
    )
    expect(
      chartPoints(auckland, new Date('2026-11-19T10:00:00Z'), { timeZone: 'Pacific/Auckland' }),
    ).toHaveLength(2)
  })

  it('has no retention before a clip is clean on two days', () => {
    const progress: Progress = {
      sessions: [
        session(1, '2026-11-19T10:00:00Z', '2026-11-19T10:20:00Z'),
        session(2, '2026-11-19T12:00:00Z', '2026-11-19T12:20:00Z'),
      ],
      clips: [clip([pass(1, '2026-11-19T10:01:00Z', 60), pass(2, '2026-11-19T12:01:00Z', 65)])],
    }
    const grouped = clipSessions(
      progress.clips[0] as Clip,
      sessionStats(progress, { timeZone: UTC }),
    )
    expect(nextSessionRetention(grouped)).toBeNull()
    expect(latestFirstClean(grouped)).toEqual({ pct: 60, at: new Date('2026-11-19T10:00:00Z') })
  })

  it('handles empty data', () => {
    const empty: Progress = { clips: [], sessions: [] }
    const stats = sessionStats(empty)
    expect(stats).toEqual([])
    expect(clipSessions(clip([]), stats)).toEqual([])
    expect(chartPoints([], NOW)).toEqual([])
    expect(trend([])).toBeNull()
    expect(nextSessionRetention([])).toBeNull()
    expect(latestFirstClean([])).toBeNull()
    expect(todayStats([], [], NOW)).toEqual({ cold: null, clean: 0, passes: 0, minutes: 0 })
    expect(revisits(empty, NOW)).toEqual([])
    expect(latestClip(empty)).toBeNull()
    expect(warmUpClip(empty, [], SONG, NOW)).toBeNull()
    expect(daysThisWeek([], NOW)).toBe(0)
    const week = weekSummary(empty, [], NOW, UTC)
    expect(week).toMatchObject({ practisedDays: 0, minutes: 0, clean: 0, gain: null })
    expect(week.days.map((d) => d.letter).join('')).toBe('FSSMTWT')
  })
})

describe('trend', () => {
  it('words a rise, a change, no change and a single session', () => {
    expect(trend([60, 70, 80])).toEqual({ kind: 'rose', from: 60, to: 80, sessions: 3 })
    expect(trend([70, 65])).toEqual({ kind: 'went', from: 70, to: 65, sessions: 2 })
    expect(trend([60, 70, 60])).toEqual({ kind: 'same', from: 60, to: 60, sessions: 3 })
    expect(trend([55])).toEqual({ kind: 'one', to: 55 })
  })
})

describe('today', () => {
  it('takes the cold start, passes and minutes of today only', () => {
    const progress: Progress = {
      sessions: [
        session(1, '2026-11-18T23:40:00Z', '2026-11-19T00:05:00Z'),
        session(2, '2026-11-19T09:00:00Z', '2026-11-19T09:10:00Z'),
        session(3, '2026-11-19T11:00:00Z', '2026-11-19T11:08:00Z'),
        session(4, '2026-11-19T12:00:00Z', '2026-11-19T12:30:00Z', { song_id: OTHER_SONG }),
      ],
      clips: [
        clip([
          pass(1, '2026-11-18T23:50:00Z', 50),
          pass(2, '2026-11-19T09:01:00Z', 55, false),
          pass(2, '2026-11-19T09:02:00Z', 55, false),
          pass(3, '2026-11-19T11:01:00Z', 60),
          pass(3, '2026-11-19T11:02:00Z', 65),
        ]),
      ],
    }
    const stats = sessionStats(progress, { timeZone: UTC })
    const grouped = clipSessions(progress.clips[0] as Clip, stats)
    const song = stats.filter((s) => s.songId === SONG)
    // The session that started before midnight belongs to yesterday.
    expect(todayStats(grouped, song, NOW, UTC)).toEqual({
      cold: 60,
      clean: 2,
      passes: 4,
      minutes: 18,
    })
  })
})

describe('this week', () => {
  const progress: Progress = {
    sessions: [
      session(1, '2026-11-01T10:00:00Z', '2026-11-01T10:30:00Z', { passes: 4, clean_passes: 2 }),
      session(2, '2026-11-13T10:00:00Z', '2026-11-13T10:30:00Z', { passes: 3, clean_passes: 3 }),
      session(3, '2026-11-14T10:00:00Z', '2026-11-14T10:00:20Z', { passes: 1, clean_passes: 1 }),
      session(4, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', { passes: 10, clean_passes: 6 }),
      session(5, '2026-11-18T10:00:00Z', '2026-11-18T10:00:30Z'),
      session(6, '2026-11-19T10:00:00Z', '2026-11-19T10:20:00Z', { song_id: OTHER_SONG }),
    ],
    clips: [
      clip([pass(1, '2026-11-01T10:05:00Z', 70), pass(4, '2026-11-17T10:05:00Z', 80)]),
      clip([pass(4, '2026-11-17T10:06:00Z', 50), pass(4, '2026-11-17T10:09:00Z', 55)], {
        loop_clip_id: id(99),
        name: 'Bridge',
      }),
    ],
  }
  const stats = sessionStats(progress, { timeZone: UTC })

  it('dots the last seven days by minutes and never counts a session that only opened', () => {
    const week = weekSummary(progress, stats, NOW, UTC)
    expect(week.days.map((d) => d.key)).toEqual([
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ])
    // 14 Nov had a pass in 20 s (one minute); 18 Nov was opened for 30 s without a pass.
    expect(week.days.map((d) => Math.round(d.minutes))).toEqual([30, 1, 0, 0, 60, 0, 20])
    expect(week.practisedDays).toBe(4)
    expect(Math.round(week.minutes)).toBe(111)
    expect(week.clean).toBe(10)
    // +10 on Chorus riff (70 before the week → 80) beats +5 on the new Bridge (50 → 55).
    expect(week.gain?.clip.name).toBe('Chorus riff')
    expect(week.gain?.pct).toBe(10)
  })

  it('makes a practised dot at least 0.45 opaque and an empty day outlined', () => {
    expect(dayDotOpacity(0)).toBe(0)
    expect(dayDotOpacity(1)).toBeGreaterThanOrEqual(0.45)
    expect(dayDotOpacity(60)).toBe(1)
  })

  it('counts days of this calendar week from Monday', () => {
    // Thursday 19 Nov: Monday is 16 Nov, so the 13th and 14th don't count.
    expect(daysThisWeek(stats, NOW, UTC)).toBe(2)
  })
})

describe('worth a revisit', () => {
  it('lists up to three clips with a best, unplayed for five days or more, newest first', () => {
    const at = (day: string) => `${day}T10:00:00Z`
    const make = (n: number, last: string | null, best: number | null) =>
      clip([], {
        loop_clip_id: id(n),
        name: `Clip ${n}`,
        last_attempt_at: last,
        best_clean_tempo_pct: best,
      })
    const progress: Progress = {
      sessions: [],
      clips: [
        make(1, at('2026-11-15'), 70), // 4 days
        make(2, at('2026-11-14'), 65), // 5 days
        make(3, at('2026-10-01'), 80),
        make(4, at('2026-11-10'), null), // never clean
        make(5, at('2026-11-12'), 60),
        make(6, at('2026-11-11'), 90),
        make(7, null, null),
      ],
    }
    expect(revisits(progress, NOW, UTC).map((r) => [r.clip.name, r.daysAgo, r.best])).toEqual([
      ['Clip 2', 5, 65],
      ['Clip 5', 7, 60],
      ['Clip 6', 8, 90],
    ])
    expect(latestClip(progress)?.name).toBe('Clip 1')
    expect(latestClip(progress, OTHER_SONG)).toBeNull()
  })
})

describe('warm up', () => {
  const progress: Progress = {
    sessions: [
      session(1, '2026-11-18T10:00:00Z', '2026-11-18T10:20:00Z'),
      session(2, '2026-11-19T10:00:00Z', null),
    ],
    clips: [
      clip([pass(1, '2026-11-18T10:01:00Z', 70, false), pass(1, '2026-11-18T10:02:00Z', 70)]),
      clip(
        [pass(1, '2026-11-18T10:03:00Z', 60, false), pass(1, '2026-11-18T10:04:00Z', 60, false)],
        { loop_clip_id: id(98), name: 'Hard bars' },
      ),
    ],
  }

  it('offers yesterday’s hardest clip on the first session of the day', () => {
    const stats = sessionStats(progress, { timeZone: UTC })
    expect(warmUpClip(progress, stats, SONG, NOW, UTC)).toMatchObject({
      clip: { name: 'Hard bars' },
      yesterday: true,
    })
    // The whole day counts: a later, easier session yesterday doesn't hide the hard clip.
    const later: Progress = {
      ...progress,
      sessions: [...progress.sessions, session(4, '2026-11-18T18:00:00Z', '2026-11-18T18:10:00Z')],
      clips: [
        ...progress.clips,
        clip([pass(4, '2026-11-18T18:01:00Z', 50, false)], { loop_clip_id: id(97), name: 'Easy' }),
      ],
    }
    expect(warmUpClip(later, sessionStats(later, { timeZone: UTC }), SONG, NOW, UTC)).toMatchObject(
      { clip: { name: 'Hard bars' } },
    )
  })

  it('stays away on a second session today or with nothing missed', () => {
    const again: Progress = {
      ...progress,
      sessions: [...progress.sessions, session(3, '2026-11-19T12:00:00Z', null)],
    }
    expect(warmUpClip(again, sessionStats(again, { timeZone: UTC }), SONG, NOW, UTC)).toBeNull()
    const clean: Progress = {
      ...progress,
      clips: [clip([pass(1, '2026-11-18T10:02:00Z', 70)])],
    }
    expect(warmUpClip(clean, sessionStats(clean, { timeZone: UTC }), SONG, NOW, UTC)).toBeNull()
  })

  it('says it was not yesterday after a longer break', () => {
    const later = new Date('2026-11-22T10:00:00Z')
    const stats = sessionStats(progress, { timeZone: UTC }).filter((s) => s.id === id(1))
    expect(warmUpClip(progress, stats, SONG, later, UTC)).toMatchObject({ yesterday: false })
  })
})

describe('pending passes', () => {
  it('adds the outbox to the server’s answer, with a new session and a new clip', () => {
    const server: Progress = {
      sessions: [session(1, '2026-11-19T10:00:00Z', null, { passes: 1, clean_passes: 1 })],
      clips: [clip([pass(1, '2026-11-19T10:01:00Z', 60)])],
    }
    const merged = withPending(server, {
      sessions: [
        {
          client_session_id: id(1),
          song_id: SONG,
          started_at: '2026-11-19T10:00:00Z',
          ended_at: '2026-11-19T10:30:00Z',
          input_mode: 'touch',
        },
        {
          client_session_id: id(2),
          song_id: SONG,
          started_at: '2026-11-19T11:00:00Z',
          input_mode: 'pedal',
        },
      ],
      attempts: [
        {
          client_attempt_id: id(50),
          client_session_id: id(2),
          loop_clip_id: CLIP,
          tempo_pct: 75,
          outcome: 'clean',
          at: '2026-11-19T11:02:00Z',
        },
        {
          client_attempt_id: id(51),
          client_session_id: id(2),
          loop_clip_id: id(77),
          tempo_pct: 40,
          outcome: 'not_yet',
          at: '2026-11-19T11:03:00Z',
        },
        {
          client_attempt_id: id(52),
          client_session_id: id(404),
          tempo_pct: 40,
          outcome: 'clean',
          at: '2026-11-19T11:04:00Z',
        },
      ],
    })
    expect(merged.sessions).toEqual([
      expect.objectContaining({ ended_at: '2026-11-19T10:30:00Z', passes: 1 }),
      expect.objectContaining({ client_session_id: id(2), passes: 2, clean_passes: 1 }),
    ])
    const [riff, fresh] = merged.clips
    expect(riff?.best_clean_tempo_pct).toBe(75)
    expect(riff?.last_attempt_at).toBe('2026-11-19T11:02:00Z')
    expect(riff?.attempts.map((a) => a.tempo_pct)).toEqual([60, 75])
    expect(fresh).toMatchObject({ loop_clip_id: id(77), song_id: SONG, best_clean_tempo_pct: null })
    // The server's answer is left as it was.
    expect(server.clips[0]?.attempts).toHaveLength(1)
  })
})
