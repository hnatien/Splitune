import { describe, expect, it } from 'vitest'
import { cn } from './utils'

// The type roles of 26 §6.2 are sizes, not colours: merged with a colour, both must survive.
describe('cn', () => {
  it('keeps a type role and a text colour together', () => {
    expect(cn('text-foreground text-label')).toBe('text-foreground text-label')
    expect(cn('text-body', 'text-muted-foreground')).toBe('text-body text-muted-foreground')
    expect(cn('text-primary-foreground', 'text-kbd')).toBe('text-primary-foreground text-kbd')
  })

  it('lets a later type role replace an earlier one, and a later colour an earlier one', () => {
    expect(cn('text-body text-label')).toBe('text-label')
    expect(cn('text-foreground text-muted-foreground')).toBe('text-muted-foreground')
    expect(cn('rounded-field rounded-panel')).toBe('rounded-panel')
    expect(cn('shadow-popover shadow-dialog')).toBe('shadow-dialog')
  })
})
