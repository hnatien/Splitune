import { describe, expect, it, vi } from 'vitest'
import { memoryOutbox } from './outbox-memory'

const sync = vi.fn()
vi.mock('@/lib/api', () => ({ client: { practice: { sync: (...a: unknown[]) => sync(...a) } } }))

const { configurePracticeSync, endSession, flushPractice, noteInput, recordAttempt, startSession } =
  await import('./practice-sync')

describe('practice sync outbox', () => {
  it('sends sessions and attempts, clears accepted ones and keeps the open session', async () => {
    const db = memoryOutbox()
    configurePracticeSync({ db })
    const session = startSession('0192f6c4-7b10-7f00-8000-000000000001')
    noteInput('keyboard')
    noteInput('pedal')
    recordAttempt({
      tempoPct: 70,
      outcome: 'clean',
      loopClipId: '0192f6c4-7b10-7f00-8000-0000000000aa',
    })
    sync.mockImplementation(
      async (body: {
        sessions: { client_session_id: string }[]
        attempts: { client_attempt_id: string }[]
      }) => ({
        accepted_sessions: body.sessions.map((s) => s.client_session_id),
        accepted_attempts: body.attempts.map((a) => a.client_attempt_id),
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPractice()
    // The attempt's own write already flushed it.
    const [body] = sync.mock.calls[0] as [{ sessions: unknown[]; attempts: unknown[] }]
    expect(body.sessions).toEqual([
      expect.objectContaining({ client_session_id: session, input_mode: 'mixed' }),
    ])
    expect(body.attempts).toEqual([
      expect.objectContaining({ tempo_pct: 70, outcome: 'clean', client_session_id: session }),
    ])
    // Attempts left; the open session stays until it ends.
    expect([...db.rows.keys()].map((k) => k.split(':')[0])).toEqual(['sessions'])
    endSession()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPractice()
    expect(db.rows.size).toBe(0)
  })

  it('keeps everything when the API is unreachable', async () => {
    const db = memoryOutbox()
    configurePracticeSync({ db })
    startSession('0192f6c4-7b10-7f00-8000-000000000001')
    recordAttempt({ tempoPct: 85, outcome: 'not_yet' })
    sync.mockRejectedValue(new TypeError('offline'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPractice()
    expect(db.rows.size).toBe(2)
  })
})
