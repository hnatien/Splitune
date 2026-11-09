import { describe, expect, it } from 'vitest'
import { parseLoopQuery } from './palette-store'

describe('parseLoopQuery', () => {
  it('reads "loop 17-20" as bars 17 to 20 (27 §3.12)', () => {
    expect(parseLoopQuery('loop 17-20')).toEqual({ start: 17, end: 20 })
    expect(parseLoopQuery('  Loop 3 – 4 ')).toEqual({ start: 3, end: 4 })
    expect(parseLoopQuery('loop 5-5')).toEqual({ start: 5, end: 5 })
  })

  it('ignores anything else', () => {
    for (const query of ['loop', 'loop 20-17', 'loop 0-4', 'chorus', 'loop 1-2 now', '17-20']) {
      expect(parseLoopQuery(query), query).toBeUndefined()
    }
  })
})
