import { describe, expect, it } from 'vitest'
import { inSpan, startTracing } from './tracing.ts'

describe('tracing', () => {
  it('stays off without an OTLP endpoint and still runs spans', async () => {
    expect(await startTracing('test', {})).toBe(false)
    expect(await inSpan('work', { analysis_id: 'a1' }, async () => 42)).toBe(42)
    await expect(
      inSpan('fails', {}, async () => {
        throw new TypeError('boom')
      }),
    ).rejects.toThrow(TypeError)
  })
})
