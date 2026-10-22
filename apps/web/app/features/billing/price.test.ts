import { describe, expect, it } from 'vitest'
import { formatPrice } from './price'

describe('formatPrice', () => {
  it('formats minor units in the plan currency', () => {
    expect(formatPrice(999, 'USD')).toBe('$9.99')
    expect(formatPrice(7999, 'USD')).toBe('$79.99')
    expect(formatPrice(1000, 'EUR')).toBe('€10.00')
  })
})
