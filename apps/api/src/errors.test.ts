import { ORPCError, ValidationError } from '@orpc/server'
import { ERROR_STATUS } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import { apiError, envelopeResponse, toEnvelope } from './errors.ts'

describe('toEnvelope', () => {
  it('keeps contract errors with their message and details', () => {
    const error = apiError('not_found', { message: 'No such song.', details: { id: 'x' } })
    expect(error.status).toBe(404)
    expect(toEnvelope(error)).toEqual({
      code: 'not_found',
      message: 'No such song.',
      details: { id: 'x' },
    })
  })

  it('lifts retry_after_s for rate_limited', () => {
    const error = apiError('rate_limited', { details: { retry_after_s: 42 } })
    expect(toEnvelope(error)).toMatchObject({ code: 'rate_limited', retry_after_s: 42 })
    expect(toEnvelope(error).details).toBeUndefined()
  })

  it('turns input validation failures into invalid_input with field paths', () => {
    const cause = new ValidationError({
      message: 'Input validation failed',
      issues: [
        { message: 'Invalid option', path: ['handedness'] },
        { message: 'Too big', path: [{ key: 'parts' }, 0, 'n'] },
      ],
    })
    const error = new ORPCError('BAD_REQUEST', { message: 'Input validation failed', cause })
    expect(toEnvelope(error)).toEqual({
      code: 'invalid_input',
      message: 'The request is not valid.',
      details: {
        issues: [
          { path: 'handedness', message: 'Invalid option' },
          { path: 'parts.0.n', message: 'Too big' },
        ],
      },
    })
  })

  it('never exposes oRPC or internal messages', () => {
    const internal = new ORPCError('INTERNAL_SERVER_ERROR', {
      message: 'Output validation failed',
      data: { secret: 'stack' },
    })
    expect(toEnvelope(internal)).toEqual({
      code: 'internal_error',
      message: 'Something went wrong on our side.',
    })
    const malformed = new ORPCError('BAD_REQUEST', { message: 'Malformed request. Ensure…' })
    expect(toEnvelope(malformed)).toEqual({
      code: 'invalid_input',
      message: 'The request is not valid.',
    })
  })

  it('maps oRPC codes by status onto contract codes', () => {
    expect(toEnvelope(new ORPCError('UNAUTHORIZED')).code).toBe('unauthenticated')
    expect(toEnvelope(new ORPCError('METHOD_NOT_SUPPORTED')).code).toBe('not_found')
    expect(toEnvelope(new ORPCError('TOO_MANY_REQUESTS')).code).toBe('rate_limited')
  })
})

describe('envelopeResponse', () => {
  it('uses the contract status and sets Retry-After', async () => {
    const res = envelopeResponse('rate_limited', { retryAfterS: 7 })
    expect(res.status).toBe(ERROR_STATUS.rate_limited)
    expect(res.headers.get('retry-after')).toBe('7')
    expect(await res.json()).toEqual({
      code: 'rate_limited',
      message: 'Too many requests. Please try again later.',
      retry_after_s: 7,
    })
  })
})
