import { describe, expect, it } from 'vitest'
import { errorName } from '../src/execute.ts'

describe('errorName', () => {
  it('names the class, never the message', () => {
    expect(errorName(new TypeError('s3://bucket/users/u1/key'))).toBe('TypeError')
    expect(errorName('boom')).toBe('string')
  })

  it('adds the Postgres SQLSTATE of a failed query', () => {
    const cause = Object.assign(new Error('relation "schedule_runs" does not exist'), {
      code: '42P01',
    })
    expect(errorName(new Error('Failed query: insert into ...', { cause }))).toBe('Error:42P01')
  })
})
