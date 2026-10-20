import { describe, expect, it } from 'vitest'
import { VERSION } from './index.ts'

describe('package scaffold', () => {
  it('exports a semver version constant', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
