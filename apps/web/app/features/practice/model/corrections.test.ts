import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryOutbox } from './outbox-memory'

const applyCorrections = vi.fn()
vi.mock('@/lib/api', () => ({
  client: { artefacts: { applyCorrections: (...args: unknown[]) => applyCorrections(...args) } },
  errorCode: (error: unknown) => (error as { code?: string }).code,
  orpc: { artefacts: { listCorrections: { queryKey: () => ['corrections'] } } },
}))

const {
  applyCorrection,
  configureCorrections,
  effectiveOps,
  flushCorrections,
  redoCorrection,
  undoCorrection,
  useCorrections,
} = await import('./corrections')

const SET_F = { op: 'set_chord', segment_id: 'c0002', label: 'F:maj' } as const
const SET_DM = { op: 'set_chord', segment_id: 'c0002', label: 'D:min' } as const

describe('corrections outbox', () => {
  let db: ReturnType<typeof memoryOutbox>
  beforeEach(() => {
    db = memoryOutbox()
    configureCorrections({ db })
    useCorrections.setState({ pending: [], undo: [], redo: [], rejected: 0, hydrated: true })
    applyCorrections.mockReset()
  })

  it('applies at once, sends idempotent batches and clears what the API took', async () => {
    applyCorrections.mockResolvedValue({ applied: [] })
    applyCorrection('art-1', SET_DM, SET_F)
    expect(useCorrections.getState().pending).toHaveLength(1)
    await flushCorrections()
    await flushCorrections()
    const [call] = applyCorrections.mock.calls
    expect(call?.[0]).toMatchObject({ id: 'art-1', ops: [{ op: SET_DM }] })
    expect(useCorrections.getState().pending).toEqual([])
    expect(db.rows.size).toBe(0)
  })

  it('keeps ops for the next try when the API is unreachable', async () => {
    vi.useFakeTimers()
    try {
      applyCorrections.mockRejectedValue(new TypeError('Failed to fetch'))
      applyCorrection('art-1', SET_DM, SET_F)
      await flushCorrections()
      expect(useCorrections.getState().pending).toHaveLength(1)
      expect(db.rows.size).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rolls back ops the API refuses and counts them for the notice', async () => {
    applyCorrections.mockRejectedValue({ code: 'invalid_input' })
    applyCorrection('art-1', SET_DM, SET_F)
    await flushCorrections()
    expect(useCorrections.getState().pending).toEqual([])
    expect(useCorrections.getState().rejected).toBe(1)
  })

  it('undoes a queued op by dropping it and a sent one with its inverse', async () => {
    applyCorrections.mockRejectedValue(new TypeError('offline'))
    applyCorrection('art-1', SET_DM, SET_F)
    expect(undoCorrection()).toBe(true)
    expect(useCorrections.getState().pending).toEqual([])
    expect(redoCorrection()).toBe(true)
    expect(useCorrections.getState().pending.map((p) => p.op)).toEqual([SET_DM])

    applyCorrections.mockResolvedValue({ applied: [] })
    await flushCorrections()
    expect(undoCorrection()).toBe(true)
    expect(useCorrections.getState().pending.map((p) => p.op)).toEqual([SET_F])
  })

  it('never puts a report on the undo stack', () => {
    applyCorrection('art-1', { op: 'report_wrong', entity_id: 'n1' }, null)
    expect(undoCorrection()).toBe(false)
  })

  it('orders server ops before this device’s pending ones, without duplicates', () => {
    const pending = [
      { id: 'a', artefactId: 'art-1', op: SET_DM, at: 1 },
      { id: 'b', artefactId: 'art-1', op: SET_F, at: 2 },
      { id: 'c', artefactId: 'art-2', op: SET_F, at: 3 },
    ]
    expect(effectiveOps([{ client_op_id: 'a', op: SET_DM }], pending, 'art-1')).toEqual([
      SET_DM,
      SET_F,
    ])
    expect(effectiveOps([], pending, undefined)).toEqual([])
  })
})
