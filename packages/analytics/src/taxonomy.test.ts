import { AnalyticsEvent, ServerAnalyticsEvent } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

// 16 §6: events never carry audio, titles, file names, URLs, emails or ids that identify a user.
const BANNED = /(^|_)(email|title|artist|name|file|filename|url|link|user|user_id|ip|address)($|_)/

function propKeys(union: z.ZodDiscriminatedUnion): Record<string, string[]> {
  return Object.fromEntries(
    union.options.map((option) => {
      const shape = (option as z.ZodObject).shape as { name: z.ZodLiteral; props: z.ZodObject }
      return [String(shape.name.value), Object.keys(shape.props.shape)]
    }),
  )
}

describe('event taxonomy', () => {
  it.each([
    ['browser', AnalyticsEvent],
    ['server', ServerAnalyticsEvent],
  ] as const)('%s events declare no identifying props', (_, union) => {
    for (const [event, keys] of Object.entries(propKeys(union))) {
      for (const key of keys) expect(key, `${event}.${key}`).not.toMatch(BANNED)
    }
  })

  it('names every event once across both unions', () => {
    const names = [
      ...Object.keys(propKeys(AnalyticsEvent)),
      ...Object.keys(propKeys(ServerAnalyticsEvent)),
    ]
    expect(new Set(names).size).toBe(names.length)
  })

  it('strips props an event does not declare', () => {
    const parsed = AnalyticsEvent.parse({
      name: 'speed_changed',
      props: { speed_pct: 70, input_mode: 'pedal', title: 'My song', email: 'a@b.c' },
    })
    expect(parsed.props).toEqual({ speed_pct: 70, input_mode: 'pedal' })
  })

  it('rejects free text where a machine code or model tag is expected', () => {
    expect(
      AnalyticsEvent.safeParse({
        name: 'upload_failed',
        props: { source: 'file', bytes_bucket: 'lt_10mb', error_code: 'TypeError: x at /a.ts' },
      }).success,
    ).toBe(false)
    expect(
      AnalyticsEvent.safeParse({
        name: 'wrong_reported',
        props: { entity: 'chord', model_ref: 'see https://x.y/z' },
      }).success,
    ).toBe(false)
  })
})
