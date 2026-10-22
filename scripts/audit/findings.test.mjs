import { describe, expect, it } from 'vitest'
import { unaccepted } from './findings.mjs'

const report = (name, version, ids) => ({
  dependencies: [{ name, version, vulns: ids.map((id) => ({ id, fix_versions: ['9.9'] })) }],
})

describe('pip-audit findings', () => {
  it('ignores the accepted package version only', () => {
    expect(unaccepted(report('transformers', '4.45.1', ['PYSEC-1']))).toEqual([])
    expect(unaccepted(report('transformers', '4.46.0', ['PYSEC-1']))).toEqual([
      { package: 'transformers@4.46.0', id: 'PYSEC-1', fix: ['9.9'] },
    ])
  })

  it('reports every other vulnerability and nothing for clean packages', () => {
    expect(unaccepted(report('numpy', '2.3.0', []))).toEqual([])
    expect(unaccepted(report('jinja2', '3.1.0', ['GHSA-a', 'GHSA-b']))).toHaveLength(2)
  })
})
