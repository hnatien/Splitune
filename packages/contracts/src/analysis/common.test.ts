import { describe, expect, it } from 'vitest'
import {
  ArtefactHeader,
  assertCompatible,
  IncompatibleSchemaVersionError,
  SCHEMA_VERSION,
  SchemaVersion,
} from './common.ts'

describe('schema versioning', () => {
  it('is semver 1.4.0', () => {
    expect(SCHEMA_VERSION).toBe('1.5.0')
  })

  it.each(['1.0.0', '1.4.2', '1.10.0'])('accepts same-major version %s', (version) => {
    expect(() => assertCompatible(version)).not.toThrow()
    expect(SchemaVersion.safeParse(version).success).toBe(true)
  })

  it.each(['2.0.0', '0.9.0', '1.0', 'v1.0.0', '1.0.0-beta', ''])('rejects %j', (version) => {
    expect(() => assertCompatible(version)).toThrow(IncompatibleSchemaVersionError)
    expect(SchemaVersion.safeParse(version).success).toBe(false)
  })

  it('only accepts 44.1 kHz on the artefact timeline', () => {
    const issues = ArtefactHeader.shape.sample_rate.safeParse(48000).error?.issues
    expect(issues).toHaveLength(1)
  })
})
