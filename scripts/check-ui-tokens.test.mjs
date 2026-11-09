import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkBase, checkRawValues } from './check-ui-tokens.mjs'

// Each 28 §3 raw-value rule with a passing and a failing sample, plus the base rules it sits on.
const tsx = (text) => checkRawValues('apps/web/app/ui/sample.tsx', text)
const css = (text) => checkRawValues('apps/web/app/ui/sample.css', text)

describe('arbitrary colours', () => {
  it('passes token utilities and token references', () => {
    expect(tsx(`<div className="bg-card text-primary-ink border-(--stem-guitar)" />`)).toEqual([])
    expect(
      tsx(`<div className="bg-[var(--loop-fill)] bg-size-[200%_100%] bg-clip-padding" />`),
    ).toEqual([])
  })
  it('fails named, system and mixed colours in arbitrary values', () => {
    expect(tsx(`<div className="bg-[white]" />`)).toEqual([
      'apps/web/app/ui/sample.tsx:1: arbitrary colour bg-[white] — use a token',
    ])
    expect(tsx(`<div className="forced-colors:border-[Highlight]" />`)).toHaveLength(1)
    expect(tsx(`<div className="text-[color:CanvasText]" />`)).toHaveLength(1)
    expect(
      tsx(`<div className="fill-[color-mix(in_oklch,var(--primary)_40%,transparent)]" />`),
    ).toHaveLength(1)
  })
  it('fails named colours in CSS colour properties', () => {
    expect(css('.a { color: var(--foreground); background: transparent; }')).toEqual([])
    expect(css('.a { background-color: white; }')).toHaveLength(1)
  })
})

describe('arbitrary radii', () => {
  it('passes the scale, inherit and values built from tokens', () => {
    expect(tsx(`<div className="rounded-3xl rounded-t-4xl rounded-[inherit]" />`)).toEqual([])
    expect(tsx(`<div className="rounded-[calc(var(--r)+var(--pad))]" />`)).toEqual([])
    expect(css('.a { border-radius: var(--radius-lg); }')).toEqual([])
  })
  it('fails raw lengths in utilities, CSS and style props', () => {
    expect(tsx(`<div className="rounded-[9px]" />`)).toEqual([
      'apps/web/app/ui/sample.tsx:1: arbitrary radius rounded-[9px] — use the rounded-* scale (26 §9)',
    ])
    expect(tsx(`<div className="rounded-tl-[calc(var(--radius-xl)-3px)]" />`)).toHaveLength(1)
    expect(css('.a { border-top-left-radius: 24px; }')).toHaveLength(1)
    expect(tsx(`<div style={{ borderRadius: 6 }} />`)).toHaveLength(1)
  })
})

describe('arbitrary font sizes', () => {
  it('passes tokens and em multiples of the surrounding token size', () => {
    expect(tsx(`<span className="text-md text-(length:--read-tab) text-[0.68em]" />`)).toEqual([])
    expect(tsx(`<span className="text-[length:var(--read-chord)]" />`)).toEqual([])
    expect(css('.a { font-size: var(--text-sm); }')).toEqual([])
  })
  it('fails raw sizes in utilities, CSS and style props', () => {
    expect(tsx(`<span className="text-[13px]" />`)).toEqual([
      'apps/web/app/ui/sample.tsx:1: arbitrary font size text-[13px] — use a text-* token (26 §6)',
    ])
    expect(tsx(`<span className="md:text-[length:1rem]" />`)).toHaveLength(1)
    expect(css('.a { font-size: 13px; }')).toHaveLength(1)
    expect(tsx(`<span style={{ fontSize: '0.75rem' }} />`)).toHaveLength(1)
  })
})

describe('arbitrary shadows', () => {
  it('passes the elevation scale and token references', () => {
    expect(tsx(`<div className="shadow-2 shadow-glow shadow-[var(--glow)]" />`)).toEqual([])
    expect(css('.a { box-shadow: var(--elevation-2); } .b { box-shadow: none; }')).toEqual([])
    expect(tsx(`<div style={{ boxShadow: 'var(--glow)' }} />`)).toEqual([])
  })
  it('fails one-off shadows', () => {
    expect(tsx(`<div className="shadow-[0_1px_2px_var(--scrim)]" />`)).toEqual([
      'apps/web/app/ui/sample.tsx:1: arbitrary shadow shadow-[0_1px_2px_var(--scrim)] — use shadow-1…3 or --glow (26 §9)',
    ])
    expect(tsx(`<div className="drop-shadow-[0_6px_20px_var(--primary)]" />`)).toHaveLength(1)
    expect(css('.a { box-shadow: 0 6px 20px var(--primary); }')).toHaveLength(1)
    expect(tsx(`<div style={{ boxShadow: '0 1px 2px var(--scrim)' }} />`)).toHaveLength(1)
  })
})

describe('style-prop colour literals', () => {
  it('passes token references, currentColor and keywords', () => {
    expect(
      tsx(
        "const a = <span style={{ color: `var(--stem-guitar)`, background: 'var(--card)', fill: 'currentColor', stroke: 'none' }} />",
      ),
    ).toEqual([])
    expect(tsx(`<path fill="none" stroke="currentColor" />`)).toEqual([])
    // A colour key outside a style prop is data, not styling.
    expect(tsx(`const stem = { color: 'teal' }`)).toEqual([])
  })
  it('fails named colours in style props and colour attributes', () => {
    expect(tsx(`<span style={{ color: 'white' }} />`)).toEqual([
      'apps/web/app/ui/sample.tsx:1: style-prop colour color: white — use a token',
    ])
    expect(tsx(`<span style={{ backgroundColor: "Canvas" }} />`)).toHaveLength(1)
    expect(tsx(`<circle fill="white" />`)).toEqual([
      'apps/web/app/ui/sample.tsx:1: colour attribute fill="white" — use currentColor or a token',
    ])
  })
})

describe('base rules', () => {
  it('still flag raw colour literals, palette classes and bare outline-none everywhere', () => {
    const file = 'apps/web/app/features/sample.tsx'
    expect(
      checkBase(file, `<div className="bg-card outline-none focus-visible:outline-2" />`),
    ).toEqual([])
    expect(checkBase(file, `<div style={{ color: 'oklch(0.5 0.1 60)' }} />`)).toHaveLength(1)
    expect(checkBase(file, `<div className="bg-red-500" />`)).toHaveLength(1)
    expect(checkBase(file, `<div className="outline-none" />`)).toHaveLength(1)
  })
})

describe('--path', () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-ui-tokens.mjs')
  const run = (...args) => {
    try {
      return {
        code: 0,
        out: execFileSync('node', [script, ...args], { encoding: 'utf8', stdio: 'pipe' }),
      }
    } catch (error) {
      return { code: error.status, out: `${error.stdout}${error.stderr}` }
    }
  }
  it('runs the raw-value rules on apps/web/app/ui by default and on each --path given', () => {
    const plain = run()
    expect(plain.code).toBe(0)
    expect(plain.out).toContain('in apps/web/app/ui/ with no arbitrary')
    const ui = run('--path', 'apps/web/app/ui', '--path', 'apps/web/app/ui/icons')
    expect(ui.code).toBe(0)
    expect(ui.out).toContain('apps/web/app/ui/, apps/web/app/ui/icons/')
  })
  it('rejects unknown arguments and a --path without a directory', () => {
    expect(run('--scope').code).toBe(1)
    expect(run('--path').code).toBe(1)
  })
})
