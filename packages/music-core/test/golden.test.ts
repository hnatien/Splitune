import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COMMANDS } from '../src/cli.ts'

const dir = new URL('../golden/', import.meta.url)
const cases = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({
    file,
    ...(JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as {
      command: string
      input: unknown
      expected: unknown
    }),
  }))
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

describe('golden files (JSON in, JSON out)', () => {
  it('covers every command, including a pickup bar', () => {
    expect(new Set(cases.map((c) => c.command))).toEqual(new Set(Object.keys(COMMANDS)))
    expect(cases.map((c) => c.file)).toContain('build-tab.pickup.json')
  })

  it.each(cases.map((c) => [c.file, c] as const))('%s', (_file, c) => {
    const run = COMMANDS[c.command]
    expect(run).toBeDefined()
    expect(JSON.parse(JSON.stringify(run?.(c.input)))).toEqual(c.expected)
  })

  it('the pickup golden renders an \\ac bar', () => {
    const pickup = cases.find((c) => c.file === 'build-tab.pickup.json')?.expected as {
      alphatex: string
      tab: { events: { bar: number }[] }
    }
    expect(pickup.alphatex).toMatch(/\\ac /)
    expect(pickup.tab.events.some((e) => e.bar === -1)).toBe(true)
  })

  it('the Node CLI reproduces a golden file over stdin/stdout', () => {
    const c = cases.find((x) => x.file === 'build-tab.fixture-corrected.json')
    const out = execFileSync('node', [cli, c?.command ?? ''], { input: JSON.stringify(c?.input) })
    expect(JSON.parse(out.toString('utf8'))).toEqual(c?.expected)
  })

  it('the CLI rejects invalid input with exit code 2 and an error envelope', () => {
    let status: number | null = null
    let stderr = ''
    try {
      execFileSync('node', [cli, 'quantize'], { input: '{"notes": []}', stdio: 'pipe' })
    } catch (error) {
      const e = error as { status: number; stderr: Buffer }
      status = e.status
      stderr = e.stderr.toString('utf8')
    }
    expect(status).toBe(2)
    expect(JSON.parse(stderr)).toMatchObject({ error: { code: 'validation_failed' } })
  })
})
