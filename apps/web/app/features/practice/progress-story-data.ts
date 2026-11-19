import type { Progress } from './model/progress-metrics'

// Progress fixtures for stories (s39): sessions placed relative to the run's own clock, so "Today"
// and "Yesterday" are what they say, and the GET /v1/progress answer they add up to. Stories only.

export type StoryProgressClip = { id: string; song_id: string; name: string | null }

export type StorySession = {
  daysAgo: number
  minutes: number
  /** [tempo, clean] per pass, in order. */
  passes: [number, boolean][]
  clip: StoryProgressClip
}

const sessionId = (n: number) => `00000000-0000-4000-b000-${String(n).padStart(12, '0')}`

/** A session `daysAgo` local days back: at noon, or today within the last half hour. */
export function startOf(daysAgo: number, minutes: number, now = new Date()): Date {
  if (daysAgo > 0) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0)
  }
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return new Date(Math.max(midnight + 60_000, now.getTime() - (minutes + 5) * 60_000))
}

/** `misses` "Not yet" at `cold`, then clean passes from `cold` up to `best` in 5 % steps. */
export function climb(cold: number, best: number, misses = 2): [number, boolean][] {
  return [
    ...Array.from({ length: misses }, (): [number, boolean] => [cold, false]),
    [cold, true],
    ...Array.from({ length: Math.max(0, (best - cold) / 5) }, (_, i): [number, boolean] => [
      cold + (i + 1) * 5,
      true,
    ]),
  ]
}

export function storyProgress(sessions: StorySession[], now = new Date()): Progress {
  const clips = new Map<string, Progress['clips'][number]>()
  const out: Progress = { clips: [], sessions: [] }
  sessions.forEach((s, i) => {
    const start = startOf(s.daysAgo, s.minutes, now)
    out.sessions.push({
      client_session_id: sessionId(i + 1),
      song_id: s.clip.song_id,
      started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + s.minutes * 60_000).toISOString(),
      passes: s.passes.length,
      clean_passes: s.passes.filter(([, clean]) => clean).length,
    })
    let entry = clips.get(s.clip.id)
    if (!entry) {
      entry = {
        loop_clip_id: s.clip.id,
        song_id: s.clip.song_id,
        name: s.clip.name,
        best_clean_tempo_pct: null,
        last_attempt_at: null,
        attempts: [],
      }
      clips.set(s.clip.id, entry)
    }
    for (const [j, [tempo, clean]] of s.passes.entries()) {
      const at = new Date(start.getTime() + (j + 1) * 30_000).toISOString()
      entry.attempts.push({
        at,
        tempo_pct: tempo,
        outcome: clean ? 'clean' : 'not_yet',
        client_session_id: sessionId(i + 1),
      })
      entry.last_attempt_at = at
      if (clean) entry.best_clean_tempo_pct = Math.max(entry.best_clean_tempo_pct ?? 0, tempo)
    }
  })
  out.clips = [...clips.values()]
  return out
}
