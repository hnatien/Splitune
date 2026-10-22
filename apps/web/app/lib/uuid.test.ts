import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { uuidv7 } from './uuid'

describe('uuidv7', () => {
  it('is a version 7 UUID the contracts accept', () => {
    const id = uuidv7()
    expect(z.uuid().safeParse(id).success).toBe(true)
    expect(id[14]).toBe('7')
    expect('89ab').toContain(id[19] ?? '')
  })

  it('sorts by creation time', () => {
    const ids = [1, 2, 3].map((ms) => uuidv7(1_760_000_000_000 + ms))
    expect([...ids].sort()).toEqual(ids)
  })
})
