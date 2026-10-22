import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Copy keys (28-ui-quality-and-design-review.md §3): every catalogue key of 27 §5.6 exists with its
// copy, every key the code uses exists, and screens carry no hard-coded user-facing strings.
const APP = fileURLToPath(new URL('.', import.meta.url))
const messages = JSON.parse(readFileSync(join(APP, '../messages/en.json'), 'utf8')) as Record<
  string,
  string
>

// 27-screens-flows-and-content.md §5.6, "Message catalogue" and "Codes from the contracts": the
// key and its exact copy (non-breaking spaces before units, 27 §5.3).
const CATALOGUE: Record<string, string> = {
  'import.unreadable':
    "We couldn't read this file. It may be damaged or in a format we don't support.",
  'import.too_long': 'Songs up to 20 minutes are supported. This one is {duration}.',
  'import.too_large': 'Files up to 500\u00a0MB are supported.',
  'import.speech': 'This sounds like speech, so results may be poor.',
  'import.live':
    "This sounds like a live recording. Parts may separate less cleanly — we'll mark rough results.",
  'import.duplicate': 'You already have this song.',
  'import.offline': "You're offline. We'll start the upload when you're back.",
  'import.url_unsupported': "We can't import from this link. Try uploading the audio file instead.",
  'import.url_failed':
    "We couldn't download this video (it may be private, removed or blocked in your region).",
  'import.url_broken': 'Link import is temporarily broken. Upload a file instead.',
  'record.permission_denied':
    "Splitune needs your microphone to record. You can allow it in your browser's site settings.",
  'analysis.queued_offline':
    'Processing machine offline — your song is queued and will start automatically.',
  'analysis.eta': 'About {minutes}\u00a0min left',
  'analysis.stems_unavailable':
    "Stems are unavailable right now; chords and beat are ready. This didn't use an analysis.",
  'analysis.failed': "We couldn't analyse this song. This didn't use an analysis.",
  'analysis.wrong_instrument': 'Is this your {instrument}?',
  'practice.chords_only':
    "We're not confident in the note-level tab for this song — showing chords.",
  'practice.rough_stem': 'This stem may contain bits of other instruments.',
  'practice.legend': 'Auto-transcribed — may contain errors (v{model})',
  'practice.stems_expired':
    'The stems for this song were removed after 180 days unused. Your loops and edits are safe.',
  'practice.not_offline': "This song isn't saved for offline yet.",
  'practice.beat_off': 'Metronome off the beat?',
  'practice.pass_prompt': 'How was that pass?',
  'practice.best_tempo': 'Best clean pass: {pct}\u00a0%',
  'plan.cap_lite':
    "You've used this month's {limit} Lite analyses. They reset on {date}. You can keep practising every song you already have.",
  'plan.welcome_available': 'Your first full analysis is free — your part isolated, plus tab.',
  'plan.cap_full': "Full analyses are part of Plus. You've used your free Welcome analysis.",
  'plan.allowance': '{left} of {limit} Lite analyses left · resets {date}',
  'billing.demo': 'Demo mode — no real charges.',
  'billing.declined': 'The (simulated) payment was declined. Nothing was charged.',
  'billing.cancelled_at_period_end':
    "Plus stays active until {date}. Then you'll be on Free — nothing you've made is removed.",
  'auth.link_sent': 'We sent a link to {email}. It works for {minutes} minutes.',
  'auth.link_expired': 'This link has expired. We can send a new one.',
  'system.offline': "You're offline. You can keep practising songs you've opened.",
  'system.unsupported': "Your browser can't run Splitune's audio engine ({missing}).",
  'system.in_app_browser': 'Open in your browser for audio and uploads.',
  'system.error': 'Something went wrong on this screen.',
  'library.empty':
    'Your library is empty. Import a song you want to learn, or start with an example.',
  'delete.song_confirm':
    "Delete “{title}”? Its stems, loops and edits will be removed. This can't be undone.",
  'delete.account_confirm': "Delete your account and everything in it? This can't be undone.",
  'practice.reason.notes_unavailable':
    "Note-level tab isn't available for this song — showing chords.",
  'practice.reason.notation_not_supported':
    "Tab for this instrument isn't supported yet — showing chords.",
  'practice.reason.rough_stem_low_conf':
    "Your part didn't separate cleanly, so the tab is unreliable — showing chords.",
  'error.invalid_input': "Some details aren't right. Check the highlighted fields.",
  'error.unauthenticated': 'Your session has ended. Sign in again to continue.',
  'error.not_found': "We couldn't find that. It may have been deleted.",
  'error.conflict': 'This changed somewhere else. Reload to see the latest version.',
  'error.rate_limited': 'Too many tries in a short time. Try again in {seconds}\u00a0s.',
}

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
  it('has every catalogue key of doc 27 §5.6 with its copy', () => {
    expect(Object.keys(CATALOGUE).filter((key) => !(key in messages))).toEqual([])
    for (const [key, copy] of Object.entries(CATALOGUE)) expect(messages[key], key).toBe(copy)
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
