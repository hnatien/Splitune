// Pure rendering for the dev dashboard (scripts/dev.mjs): state in, terminal frame out. Status is
// never shown by colour alone: every state has its own glyph and word.
import { stripVTControlCharacters } from 'node:util'
import { renderMark, TAGLINE, WORDMARK } from './logo.mjs'

// indigo-8 from packages/ui-tokens (oklch 0.6 0.16 278): readable on light and dark terminals.
const ACCENT_RGB = [108, 114, 221]
const ACCENT_256 = 62

export const SPINNER = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']

// biome-ignore lint/suspicious/noControlCharactersInRegex: strips control characters from child output
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g

export function sanitize(text) {
  return stripVTControlCharacters(text).replace(/\t/g, '  ').replace(CONTROL, '')
}

// colorDepth as reported by tty.WriteStream#getColorDepth: 1 means no colour (NO_COLOR, dumb
// terminals), where bold, dim and underline still carry emphasis.
export function createTheme(colorDepth) {
  const sgr = (open, close) => (text) => (text ? `\x1b[${open}m${text}\x1b[${close}m` : text)
  const colour = (code) => (colorDepth > 1 ? sgr(code, 39) : (text) => text)
  let accent = colour(34)
  if (colorDepth >= 24) accent = colour(`38;2;${ACCENT_RGB.join(';')}`)
  else if (colorDepth >= 8) accent = colour(`38;5;${ACCENT_256}`)
  return {
    accent,
    green: colour(32),
    yellow: colour(33),
    red: colour(31),
    bold: sgr(1, 22),
    dim: sgr(2, 22),
    underline: sgr(4, 24),
    plain: (text) => text,
  }
}

// Fits a row of [text, style] segments into exactly `width` columns: truncated with an ellipsis or
// padded with spaces. Every character used here is one column wide.
export function row(segments, width) {
  let out = ''
  let used = 0
  for (const [text, style] of segments) {
    const chars = Array.from(text)
    const room = width - used
    if (room <= 0) break
    if (chars.length > room) {
      out += style(`${chars.slice(0, room - 1).join('')}…`)
      used = width
      break
    }
    out += style(text)
    used += chars.length
  }
  return out + ' '.repeat(width - used)
}

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

// Fields the dashboard already shows (service, level) or that only matter in production logs.
const LOG_FIELDS_SKIPPED = new Set([
  'ts',
  'at',
  'level',
  'logger',
  'service',
  'msg',
  'message',
  'worker_id',
  'exc',
  'exc_type',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// pnpm's own report after a script fails: the service row already says it exited.
const PNPM_NOISE = [
  /^\[?ELIFECYCLE\]?\s/,
  /ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL/,
  /"pnpm recursive run" failed/,
]
// Vite prefixes its messages with a wall-clock time.
const CLOCK_PREFIX = /^\d{1,2}:\d{2}:\d{2} [AP]M /

// Paths relative to the checkout, without the package-store or virtualenv prefix.
export function shortenPaths(text, root) {
  let out = text
    .replace(/file:\/\//g, '')
    .replace(/[^\s("']*\/node_modules\/\.pnpm\/[^/]+\/node_modules\//g, '')
    .replace(/[^\s("']*\/site-packages\//g, '')
  if (root) out = out.replaceAll(`${root}/`, '')
  return out
}

function formatValue(key, value) {
  if (typeof value === 'number' && key.endsWith('_s')) return `${Math.round(value * 10) / 10}s`
  if (typeof value === 'string') return UUID.test(value) ? value.slice(0, 8) : value
  if (Array.isArray(value)) return value.join(',')
  if (value && typeof value === 'object')
    return Object.entries(value)
      .map(([k, v]) => `${k}:${formatValue(k, v)}`)
      .join(' ')
  return String(value)
}

// A Python traceback becomes two lines: where it was raised and what was raised.
function tracebackDetail(exc, root) {
  const lines = exc.split('\n').filter((line) => line.trim())
  const frame = lines.findLast((line) => line.trim().startsWith('File "'))
  const where = frame?.match(/File "([^"]+)", line (\d+), in (\S+)/)
  const detail = where ? [`at ${shortenPaths(where[1], root)}:${where[2]} in ${where[3]}`] : []
  const raised = lines.at(-1)?.trim()
  if (raised) detail.push(shortenPaths(raised, root))
  return detail
}

// One child output line for display: `{ level, text, detail }`, or null for lines that only repeat
// what the service row shows. The workers log one JSON object per line; it becomes its message and
// remaining fields, with ids cut to 8 characters and durations in seconds.
export function parseLogLine(raw, { root } = {}) {
  const text = sanitize(raw).trimEnd()
  if (text.startsWith('{')) {
    try {
      const entry = JSON.parse(text)
      const message = entry.msg ?? entry.message
      if (typeof message === 'string') {
        const fields = Object.entries(entry)
          .filter(([key]) => !LOG_FIELDS_SKIPPED.has(key))
          .map(([key, value]) => `${key.replace(/_s$/, '')}=${formatValue(key, value)}`)
        return {
          level: levelOf(entry.level),
          text: sanitize([message, ...fields].join('  ')),
          detail:
            typeof entry.exc === 'string' ? tracebackDetail(entry.exc, root).map(sanitize) : [],
        }
      }
    } catch {
      // Not JSON after all: shown as plain text below.
    }
  }
  if (PNPM_NOISE.some((pattern) => pattern.test(text.trim()))) return null
  // docker compose: "Container splitune-postgres-1 Running" → "postgres running".
  const container = text.trim().match(/^Container splitune-(\S+?)-\d+\s+(\w+)$/)
  if (container)
    return { level: 'info', text: `${container[1]} ${container[2].toLowerCase()}`, detail: [] }
  // Node's own frames say nothing about our code.
  if (/^\s*at .*\(?node:internal\//.test(text)) return null
  const line = shortenPaths(text.replace(CLOCK_PREFIX, ''), root)
  return {
    level: /\b(error|failed|exception|traceback)\b/i.test(line) ? 'error' : 'info',
    text: line,
    detail: [],
  }
}

function levelOf(level) {
  if (level === 'error' || level === 'fatal' || level === 'critical') return 'error'
  if (level === 'warn' || level === 'warning') return 'warn'
  return 'info'
}

function statusCell(service, tick, theme) {
  switch (service.status) {
    case 'starting':
      return [SPINNER[tick % SPINNER.length], theme.accent, 'starting', theme.accent]
    case 'stopping':
      return [SPINNER[tick % SPINNER.length], theme.yellow, 'stopping', theme.yellow]
    case 'ready':
      return ['●', theme.green, service.kind === 'task' ? 'up' : 'running', theme.green]
    case 'failed':
      return ['✕', theme.red, `exited ${service.exitCode ?? ''}`.trim(), theme.red]
    case 'stopped':
      return ['○', theme.dim, 'stopped', theme.dim]
    default:
      return ['○', theme.dim, 'waiting', theme.dim]
  }
}

const LABEL_WIDTH = 13
const STATUS_WIDTH = 10
const HEADER_MAX_WIDTH = 100
// Below this width the pid and uptime give their room to the service's detail.
const PID_MIN_WIDTH = 90

function header(state, width, theme, compact) {
  const meta = ['local dev', state.branch, state.cwd].filter(Boolean).join(' · ')
  const boxWidth = Math.min(width, HEADER_MAX_WIDTH)
  const inner = boxWidth - 4
  if (compact || inner < WORDMARK[0].length) {
    return [
      row(
        [
          ['✻ ', theme.accent],
          ['Splitune', theme.bold],
          [` ${meta}`, theme.dim],
        ],
        width,
      ),
    ]
  }

  const mark = renderMark()
  const markWidth = mark[0].length
  const textWidth = Math.max(TAGLINE.length, meta.length, WORDMARK[0].length)
  const border = theme.accent
  const top = border(`╭${'─'.repeat(boxWidth - 2)}╮`)
  const bottom = border(`╰${'─'.repeat(boxWidth - 2)}╯`)
  const framed = (content) => `${border('│')} ${content} ${border('│')}`
  if (inner < markWidth + 3 + textWidth) {
    const lines = [
      ...WORDMARK.map((line) => [line, theme.bold]),
      [TAGLINE, theme.plain],
      [meta, theme.dim],
    ]
    return [top, ...lines.map((segment) => framed(row([segment], inner))), bottom]
  }

  // The wordmark sits beside the middle of the mark, the tagline and checkout below it.
  const right = ['', ...WORDMARK, '', TAGLINE, meta]
  const styles = [
    theme.plain,
    theme.bold,
    theme.bold,
    theme.bold,
    theme.plain,
    theme.plain,
    theme.dim,
  ]
  const lines = mark.map((cells, i) => {
    const art = cells.map((cell) => (cell.accent ? theme.accent(cell.char) : cell.char)).join('')
    return framed(
      art +
        row(
          [
            ['   ', theme.plain],
            [right[i] ?? '', styles[i]],
          ],
          inner - markWidth,
        ),
    )
  })
  return [top, ...lines, bottom]
}

// Columns kept clear between a service's detail and its pid and uptime.
const DETAIL_GAP = 3

// The pid and uptime, right-aligned in their own column.
function serviceRight(service, state, width) {
  if (width < PID_MIN_WIDTH) return ''
  const running =
    service.kind !== 'task' && (service.status === 'ready' || service.status === 'starting')
  const pid = service.pid ? `pid ${service.pid}` : ''
  const uptime =
    running && service.startedAt ? formatDuration(state.now - service.startedAt).padStart(7) : ''
  return [pid, uptime].filter(Boolean).join('   ')
}

function serviceRow(service, state, width, theme, rightWidth) {
  const [glyph, glyphStyle, word, wordStyle] = statusCell(service, state.tick, theme)
  const focused = state.focus === service.id
  // Every row truncates its detail at the same column, clear of the widest pid and uptime.
  const reserved = rightWidth ? rightWidth + DETAIL_GAP + 2 : 0
  const left = row(
    [
      [focused ? '› ' : '  ', theme.accent],
      [glyph, glyphStyle],
      [' ', theme.plain],
      [service.label.padEnd(LABEL_WIDTH), focused ? theme.bold : theme.plain],
      [word.padEnd(STATUS_WIDTH), wordStyle],
      [service.detail ?? '', service.status === 'ready' ? theme.plain : theme.dim],
    ],
    Math.max(0, width - reserved),
  )
  if (!rightWidth) return left
  const right = serviceRight(service, state, width).padStart(rightWidth)
  return `${left}${' '.repeat(DETAIL_GAP)}${theme.dim(right)}  `
}

function tabs(state, theme) {
  const names = [{ id: null, label: 'all' }, ...state.services]
  const segments = [['  Logs  ', theme.bold]]
  for (const tab of names) {
    const active = state.focus === tab.id
    segments.push([
      tab.label,
      active ? (text) => theme.underline(theme.accent(theme.bold(text))) : theme.dim,
    ])
    segments.push(['   ', theme.plain])
  }
  return segments
}

function logRow(entry, state, width, theme) {
  const glyph =
    entry.level === 'error'
      ? ['✕ ', theme.red]
      : entry.level === 'warn'
        ? ['▲ ', theme.yellow]
        : ['  ', theme.plain]
  const label = state.focus
    ? []
    : [
        [entry.service.padEnd(LABEL_WIDTH), theme.dim],
        ['│ ', theme.dim],
      ]
  return row(
    [
      ['  ', theme.plain],
      glyph,
      ...label,
      [entry.text, entry.level === 'error' ? theme.red : theme.plain],
    ],
    width,
  )
}

// The visible log lines: the tail of the focused service's (or everyone's) log, `scroll` lines up.
export function visibleLogs(state, height) {
  const entries = state.focus
    ? state.logs.filter((entry) => entry.service === state.focus)
    : state.logs
  const maxScroll = Math.max(0, entries.length - height)
  const scroll = Math.min(state.scroll, maxScroll)
  return {
    entries: entries.slice(entries.length - height - scroll, entries.length - scroll),
    scroll,
    maxScroll,
  }
}

export function renderFrame(state, { cols, rows, theme }) {
  const width = Math.max(20, cols)
  // Keep at least a few log lines on short terminals: the logo goes first.
  const lines = [...header(state, width, theme, rows < 24), '']
  const rightWidth = Math.max(
    0,
    ...state.services.map((service) => serviceRight(service, state, width).length),
  )
  for (const service of state.services)
    lines.push(serviceRow(service, state, width, theme, rightWidth))
  lines.push('')

  const footerLines = 1
  const logHeight = Math.max(0, rows - lines.length - 2 - footerLines)
  const { entries, scroll } = visibleLogs(state, logHeight)
  const position = scroll > 0 ? `↑ ${scroll} more below` : 'following'
  lines.push(row([...tabs(state, theme), [position, theme.dim]], width))
  lines.push(theme.dim('─'.repeat(width)))
  for (const entry of entries) lines.push(logRow(entry, state, width, theme))
  while (lines.length < rows - footerLines) lines.push('')

  const focused = state.services.find((s) => s.id === state.focus)
  const keys = state.quitting
    ? [['  stopping services · press q again to force quit', theme.yellow]]
    : [
        ['  ←→', theme.bold],
        [' logs   ', theme.dim],
        ['↑↓', theme.bold],
        [' scroll   ', theme.dim],
        ['End', theme.bold],
        [' follow   ', theme.dim],
        ['r', theme.bold],
        [` restart ${focused?.label ?? 'all'}   `, theme.dim],
        ['q', theme.bold],
        [' quit', theme.dim],
      ]
  lines.push(row(keys, width))
  return { lines: lines.slice(0, rows), logHeight }
}
