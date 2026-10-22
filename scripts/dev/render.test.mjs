import { stripVTControlCharacters } from 'node:util'
import { describe, expect, it } from 'vitest'
import { renderMark, WORDMARK } from './logo.mjs'
import {
  createTheme,
  formatDuration,
  parseLogLine,
  renderFrame,
  row,
  visibleLogs,
} from './render.mjs'

const now = 1_000_000

function makeState(overrides = {}) {
  return {
    services: [
      { id: 'stack', label: 'stack', kind: 'task', status: 'ready', detail: 'postgres :5432' },
      {
        id: 'web',
        label: 'web',
        status: 'ready',
        detail: 'http://localhost:3000/',
        pid: 4123,
        startedAt: now - 65_000,
      },
      { id: 'node-worker', label: 'node-worker', status: 'starting', pid: 4124, startedAt: now },
      { id: 'ml-worker', label: 'ml-worker', status: 'failed', exitCode: 1 },
    ],
    logs: Array.from({ length: 40 }, (_, i) => ({
      service: i % 2 ? 'web' : 'ml-worker',
      level: 'info',
      text: `line ${i}`,
    })),
    focus: null,
    scroll: 0,
    tick: 0,
    now,
    quitting: false,
    branch: 'dev',
    cwd: '~/Projects/Splitune',
    ...overrides,
  }
}

const plain = (lines) => lines.map((line) => stripVTControlCharacters(line))

describe('renderMark', () => {
  it('draws the icon as a 28×7 block of braille cells', () => {
    const mark = renderMark()
    expect(mark).toHaveLength(7)
    for (const cells of mark) {
      expect(cells).toHaveLength(28)
      for (const { char } of cells) expect(char).toMatch(/^[⠀-⣿]$/)
    }
  })

  it('colours only the upper branch of the fork', () => {
    const mark = renderMark()
    const accent = mark.flatMap((cells, y) =>
      cells.flatMap((cell, x) => (cell.accent ? [{ x, y }] : [])),
    )
    expect(accent.length).toBeGreaterThan(0)
    // The branch starts at the fork (x 16 of 32) and rises to the top right.
    for (const { x, y } of accent) {
      expect(x).toBeGreaterThanOrEqual(13)
      expect(y).toBeLessThanOrEqual(4)
    }
    expect(mark[6].some((cell) => cell.accent)).toBe(false)
  })
})

describe('row', () => {
  const theme = createTheme(1)

  it('pads to the width', () => {
    expect(row([['ab', theme.plain]], 5)).toBe('ab   ')
  })

  it('truncates with an ellipsis across segments', () => {
    expect(
      row(
        [
          ['abc', theme.plain],
          ['defgh', theme.plain],
        ],
        6,
      ),
    ).toBe('abcde…')
  })

  it('keeps styling inside the visible width', () => {
    const coloured = createTheme(24)
    const out = row([['abcdef', coloured.red]], 4)
    expect(stripVTControlCharacters(out)).toBe('abc…')
  })
})

describe('createTheme', () => {
  it('adds no colour at depth 1 but keeps emphasis', () => {
    const theme = createTheme(1)
    expect(theme.red('x')).toBe('x')
    expect(theme.accent('x')).toBe('x')
    expect(theme.bold('x')).toBe('\x1b[1mx\x1b[22m')
  })

  it('uses the indigo accent in true colour', () => {
    expect(createTheme(24).accent('x')).toBe('\x1b[38;2;108;114;221mx\x1b[39m')
    expect(createTheme(8).accent('x')).toBe('\x1b[38;5;62mx\x1b[39m')
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [59_999, '59s'],
    [65_000, '1m 05s'],
    [3_725_000, '1h 02m'],
    [-5, '0s'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})

describe('parseLogLine', () => {
  it('reads a worker JSON line into level, message and fields', () => {
    const line = JSON.stringify({
      ts: '2026-10-22T10:36:36Z',
      level: 'warning',
      logger: 'splitune.worker',
      msg: 'job retried',
      job_id: 'j1',
      slots: { cpu0: ['decode'] },
    })
    expect(parseLogLine(line)).toEqual({
      level: 'warn',
      text: 'job retried  job_id=j1  slots={"cpu0":["decode"]}',
    })
  })

  it('maps error levels', () => {
    expect(parseLogLine('{"level":"error","msg":"boom"}').level).toBe('error')
  })

  it('strips ANSI and control characters from plain lines', () => {
    expect(parseLogLine('\x1b[32m➜\x1b[39m  Local:\thttp://localhost:3000/\x07')).toEqual({
      level: 'info',
      text: '➜  Local:  http://localhost:3000/',
    })
  })

  it('flags plain lines that look like errors', () => {
    expect(parseLogLine('Traceback (most recent call last):').level).toBe('error')
  })

  it('keeps a line that only looks like JSON', () => {
    expect(parseLogLine('{not json').text).toBe('{not json')
  })
})

describe('visibleLogs', () => {
  it('shows the tail and clamps scrolling to the oldest line', () => {
    const state = makeState({ scroll: 1000 })
    const { entries, scroll, maxScroll } = visibleLogs(state, 10)
    expect(maxScroll).toBe(30)
    expect(scroll).toBe(30)
    expect(entries.map((e) => e.text)).toEqual(Array.from({ length: 10 }, (_, i) => `line ${i}`))
  })

  it('filters to the focused service', () => {
    const { entries } = visibleLogs(makeState({ focus: 'web' }), 100)
    expect(entries).toHaveLength(20)
    expect(entries.every((e) => e.service === 'web')).toBe(true)
  })
})

describe('renderFrame', () => {
  it.each([
    [120, 40],
    [80, 24],
    [60, 30],
    [100, 16],
    [20, 10],
  ])('fills exactly %i×%i', (cols, rows) => {
    const { lines } = renderFrame(makeState(), { cols, rows, theme: createTheme(24) })
    expect(lines).toHaveLength(rows)
    for (const line of plain(lines)) expect(line.length).toBeLessThanOrEqual(cols)
  })

  it('shows the mark and wordmark on a roomy terminal', () => {
    const { lines } = renderFrame(makeState(), { cols: 120, rows: 40, theme: createTheme(1) })
    const text = plain(lines).join('\n')
    for (const line of WORDMARK) expect(text).toContain(line.trimEnd())
    expect(text).toContain('⣿')
    expect(text).toContain('dev · ~/Projects/Splitune')
  })

  it('falls back to one header line on a short terminal', () => {
    const { lines } = renderFrame(makeState(), { cols: 120, rows: 16, theme: createTheme(1) })
    expect(plain(lines)[0]).toMatch(/^✻ Splitune local dev · dev/)
  })

  it('gives every status a glyph and a word, not only a colour', () => {
    const { lines } = renderFrame(makeState(), { cols: 120, rows: 40, theme: createTheme(1) })
    const text = plain(lines).join('\n')
    expect(text).toMatch(/● stack {8}up/)
    expect(text).toMatch(/● web {10}running {3}http:\/\/localhost:3000\/.*pid 4123 {4}1m 05s/)
    expect(text).toMatch(/· node-worker {2}starting/)
    expect(text).toMatch(/✕ ml-worker {4}exited 1/)
  })

  it('shows no uptime for the one-shot stack task', () => {
    const state = makeState()
    state.services[0].startedAt = now - 30_000
    const { lines } = renderFrame(state, { cols: 120, rows: 40, theme: createTheme(1) })
    expect(plain(lines).find((line) => line.includes('● stack'))).not.toContain('30s')
  })

  it('hides pid and uptime on a narrow terminal', () => {
    const { lines } = renderFrame(makeState(), { cols: 70, rows: 40, theme: createTheme(1) })
    expect(plain(lines).join('\n')).not.toContain('pid 4123')
  })

  it('reports the log height it drew', () => {
    const { lines, logHeight } = renderFrame(makeState({ logs: [] }), {
      cols: 120,
      rows: 40,
      theme: createTheme(1),
    })
    const rule = plain(lines).findIndex((line) => /^─+$/.test(line))
    expect(rule + 1 + logHeight + 1).toBe(40)
  })

  it('tells the user how to force quit while stopping', () => {
    const { lines } = renderFrame(makeState({ quitting: true }), {
      cols: 120,
      rows: 40,
      theme: createTheme(1),
    })
    expect(plain(lines).at(-1)).toContain('press q again to force quit')
  })
})
