import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Copy keys (28-ui-quality-and-design-review.md §3): every catalogue key of 27 §5.6 exists, every
// key the code uses exists, and screens carry no hard-coded user-facing strings.
const APP = fileURLToPath(new URL('.', import.meta.url))
const messages = JSON.parse(readFileSync(join(APP, '../messages/en.json'), 'utf8')) as Record<
  string,
  string
>

// 27-screens-flows-and-content.md §5.6, "Message catalogue" and "Codes from the contracts".
const CATALOGUE = [
  'import.unreadable',
  'import.too_long',
  'import.too_large',
  'import.speech',
  'import.live',
  'import.duplicate',
  'import.offline',
  'import.url_unsupported',
  'import.url_failed',
  'import.url_broken',
  'record.permission_denied',
  'analysis.queued_offline',
  'analysis.eta',
  'analysis.stems_unavailable',
  'analysis.failed',
  'analysis.wrong_instrument',
  'practice.chords_only',
  'practice.rough_stem',
  'practice.legend',
  'practice.stems_expired',
  'practice.not_offline',
  'practice.beat_off',
  'practice.pass_prompt',
  'practice.best_tempo',
  'plan.cap_lite',
  'plan.welcome_available',
  'plan.cap_full',
  'plan.allowance',
  'billing.demo',
  'billing.declined',
  'billing.cancelled_at_period_end',
  'auth.link_sent',
  'auth.link_expired',
  'system.offline',
  'system.unsupported',
  'system.in_app_browser',
  'system.error',
  'library.empty',
  'delete.song_confirm',
  'delete.account_confirm',
  'practice.reason.notes_unavailable',
  'practice.reason.notation_not_supported',
  'practice.reason.rough_stem_low_conf',
  'error.invalid_input',
  'error.unauthenticated',
  'error.not_found',
  'error.conflict',
  'error.rate_limited',
]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'paraglide' ? [] : sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : []
  })
}

const files = sources(APP)
const screens = files.filter((f) => /\/(routes|features)\//.test(f) && f.endsWith('.tsx'))

// JSX text with a letter in it, and string literals in props that reach people.
const JSX_TEXT = /(?<![=-])>\s*([A-Za-z][\w ,.'’!?:–—…-]*?)\s*<(?=[/A-Za-z])/g
const USER_PROP =
  /\b(?:aria-label|title|placeholder|alt|label|description|text|caption|chooseLabel|dropLabel|hint|prompt)=(["'])([^"']*[A-Za-z][^"']*)\1/g

describe('copy keys', () => {
  it('has every catalogue key of doc 27 §5.6', () => {
    expect(CATALOGUE.filter((key) => !(key in messages))).toEqual([])
  })

  it('defines every key the code uses', () => {
    const used = new Set(
      files.flatMap((f) =>
        [...readFileSync(f, 'utf8').matchAll(/m\['([a-z0-9_.]+)'\]/g)].map((x) => x[1] ?? ''),
      ),
    )
    expect([...used].filter((key) => !(key in messages))).toEqual([])
  })

  it('keeps user-facing strings out of screens', () => {
    const found = screens.flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return [...text.matchAll(JSX_TEXT), ...text.matchAll(USER_PROP)].map(
        (match) => `${relative(APP, file)}: ${(match[2] ?? match[1] ?? '').trim()}`,
      )
    })
    expect(found).toEqual([])
  })

  it('finds hard-coded copy when it is there', () => {
    const planted = '<Button aria-label="Play">Start practising</Button>'
    expect([...planted.matchAll(JSX_TEXT)].map((m) => m[1])).toEqual(['Start practising'])
    expect([...planted.matchAll(USER_PROP)].map((m) => m[2])).toEqual(['Play'])
  })
})
