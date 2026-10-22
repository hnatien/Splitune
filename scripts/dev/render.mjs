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

const LOG_FIELDS_SKIPPED = new Set(['ts', 'at', 'level', 'logger', 'service', 'msg', 'message'])

// The workers log one JSON object per line; show its level, message and remaining fields compactly.
export function parseLogLine(raw) {
  const text = sanitize(raw).trimEnd()
  if (text.startsWith('{')) {
    try {
      const entry = JSON.parse(text)
      const message = entry.msg ?? entry.message
      if (typeof message === 'string') {
        const fields = Object.entries(entry)
          .filter(([key]) => !LOG_FIELDS_SKIPPED.has(key))
          .map(
            ([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`,
          )
        return { level: levelOf(entry.level), text: [message, ...fields].join('  ') }
      }
    } catch {
      // Not JSON after all: shown as plain text below.
    }
  }
  return { level: /\b(error|failed|exception|traceback)\b/i.test(text) ? 'error' : 'info', text }
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

function serviceRow(service, state, width, theme) {
  const [glyph, glyphStyle, word, wordStyle] = statusCell(service, state.tick, theme)
  const right = []
  const running =
    service.kind !== 'task' && (service.status === 'ready' || service.status === 'starting')
  if (width >= PID_MIN_WIDTH && service.pid) right.push(`pid ${service.pid}`)
  if (width >= PID_MIN_WIDTH && running && service.startedAt)
    right.push(formatDuration(state.now - service.startedAt).padStart(7))
  const rightText = right.join('   ')
  const focused = state.focus === service.id
  const left = row(
    [
      [focused ? '› ' : '  ', theme.accent],
      [glyph, glyphStyle],
      [' ', theme.plain],
      [service.label.padEnd(LABEL_WIDTH), focused ? theme.bold : theme.plain],
      [word.padEnd(STATUS_WIDTH), wordStyle],
      [service.detail ?? '', service.status === 'ready' ? theme.plain : theme.dim],
    ],
    Math.max(0, width - rightText.length - 2),
  )
  return `${left}${theme.dim(rightText)}  `
}

function tabs(state, theme) {
  const names = [
    { id: null, label: 'all', key: '0' },
    ...state.services.map((s, i) => ({ id: s.id, label: s.label, key: String(i + 1) })),
  ]
  const segments = [['  Logs  ', theme.bold]]
  for (const tab of names) {
    const active = state.focus === tab.id
    segments.push([`${tab.key} `, theme.dim])
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
  for (const service of state.services) lines.push(serviceRow(service, state, width, theme))
  lines.push('')

  const footerLines = 1
  const logHeight = Math.max(0, rows - lines.length - 2 - footerLines)
  const { entries, scroll } = visibleLogs(state, logHeight)
  const position = scroll > 0 ? `↑ ${scroll} more below` : 'following'
  lines.push(row([...tabs(state, theme), [position, theme.dim]], width))
  lines.push(theme.dim('─'.repeat(width)))
  for (const entry of entries) lines.push(logRow(entry, state, width, theme))
  while (lines.length < rows - footerLines) lines.push('')

  const keys = state.quitting
    ? [['  stopping services · press q again to force quit', theme.yellow]]
    : [
        [`  0-${state.services.length}`, theme.bold],
        [' logs   ', theme.dim],
        ['↑↓', theme.bold],
        [' scroll   ', theme.dim],
        ['End', theme.bold],
        [' follow   ', theme.dim],
        ['r', theme.bold],
        [' restart   ', theme.dim],
        ['q', theme.bold],
        [' quit', theme.dim],
      ]
  lines.push(row(keys, width))
  return { lines: lines.slice(0, rows), logHeight }
}
