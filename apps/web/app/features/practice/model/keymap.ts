// Hands-busy input (12 §8): the default keys page-turner pedals send, plus keys learned per
// device ("Learn this pedal"). Matching is on KeyboardEvent.key, which pedals report as the key
// they emulate (PageDown, ArrowRight, …). Speed is `,` / `.` (Shift: 1 %); ↑ and ↓, which most
// pedals send out of the box, never change speed: until a pedal is set up they only say "Pedal
// detected? Set it up". Character keys can be switched off (WCAG 2.1.4); modifier chords, the
// non-character keys pedals send and learned keys keep working.

// In 12 §8's order (Settings → Keyboard & pedal lists them as they come here).
export const ACTIONS = [
  'playPause',
  'restart',
  'next',
  'slower',
  'faster',
  'clean',
  'notYet',
  'toggleLoop',
  'mutePart',
  'nextUnsure',
  'previousUnsure',
  'fixBar',
  'previousPhrase',
  'nextPhrase',
  'cueNote',
] as const

export type Action = (typeof ACTIONS)[number]

export const DEFAULT_KEYS: Record<Action, string[]> = {
  playPause: [' ', 'Enter'],
  restart: ['ArrowLeft', 'PageUp'],
  next: ['ArrowRight', 'PageDown'],
  slower: [','],
  faster: ['.'],
  clean: ['c'],
  notYet: ['n'],
  toggleLoop: ['l'],
  mutePart: ['m'],
  // The Fix tab (12 §4): through the unsure spots, and the bar that's playing.
  nextUnsure: ['j'],
  previousUnsure: ['k'],
  fixBar: ['e'],
  // Vocals (step 18c): phrase by phrase, and the note a phrase starts on.
  previousPhrase: ['['],
  nextPhrase: [']'],
  cueNote: ['p'],
}

/** Learned keys per action, added to the defaults (one learned key per action). */
export type LearnedKeys = Partial<Record<Action, string>>

export const KEYS_STORAGE_KEY = 'splitune.keys'

const normal = (key: string) => (key.length === 1 ? key.toLowerCase() : key)

export function keysFor(action: Action, learned: LearnedKeys): string[] {
  const own = learned[action]
  return own === undefined ? DEFAULT_KEYS[action] : [own, ...DEFAULT_KEYS[action]]
}

/** The action a key triggers; a learned key wins over a default bound elsewhere. */
export function actionFor(key: string, learned: LearnedKeys): Action | undefined {
  const k = normal(key)
  const own = ACTIONS.find(
    (action) => learned[action] !== undefined && normal(learned[action]) === k,
  )
  return own ?? ACTIONS.find((action) => DEFAULT_KEYS[action].some((d) => normal(d) === k))
}

/** Keys most pedals send out of the box (AirTurn mode 2, iRig BlueTurn), never speed (12 §8). */
export const PEDAL_ARROWS = new Set(['ArrowUp', 'ArrowDown'])

/**
 * A character key shortcut (WCAG 2.1.4): one letter, digit, punctuation or symbol. Space, Enter,
 * the arrows and Page Up/Down aren't: pedals send them, and they stay on with single keys off.
 */
export const isCharacterKey = (key: string) => key.length === 1 && key !== ' '

type KeyInput = Pick<KeyboardEvent, 'key' | 'shiftKey'> & { code?: string }

/** The key as the map knows it: Shift turns `,` and `.` into `<` and `>` on most layouts. */
export function keyOf(event: KeyInput): string {
  if (event.shiftKey && (event.key === '<' || event.code === 'Comma')) return ','
  if (event.shiftKey && (event.key === '>' || event.code === 'Period')) return '.'
  return event.key
}

export type KeyResult =
  | { kind: 'action'; action: Action; fine: boolean; learned: boolean }
  /** ↑ / ↓ before any pedal is set up: "Pedal detected? Set it up". */
  | { kind: 'pedal-hint' }
  | { kind: 'none' }

/**
 * What a key press does on the practice screen. Learned keys always act (they are a pedal); with
 * single keys off, character keys are inert; ↑/↓ act only when learned, and before any key is
 * learned they ask for the pedal to be set up. `fine`: Shift with speed, a 1 % step.
 */
export function resolveKey(event: KeyInput, learned: LearnedKeys, singleKeys: boolean): KeyResult {
  const key = keyOf(event)
  const k = normal(key)
  const own = ACTIONS.find(
    (action) => learned[action] !== undefined && normal(learned[action]) === k,
  )
  if (own) return { kind: 'action', action: own, fine: event.shiftKey, learned: true }
  if (PEDAL_ARROWS.has(key)) {
    return Object.keys(learned).length === 0 ? { kind: 'pedal-hint' } : { kind: 'none' }
  }
  if (!singleKeys && isCharacterKey(key)) return { kind: 'none' }
  const action = ACTIONS.find((a) => DEFAULT_KEYS[a].some((d) => normal(d) === k))
  return action
    ? { kind: 'action', action, fine: event.shiftKey, learned: false }
    : { kind: 'none' }
}

/** Learning a key takes it away from any other action that had learned it. */
export function learn(learned: LearnedKeys, action: Action, key: string): LearnedKeys {
  const next: LearnedKeys = {}
  for (const other of ACTIONS) {
    const own = learned[other]
    if (other !== action && own !== undefined && normal(own) !== normal(key)) next[other] = own
  }
  next[action] = key
  return next
}

/** Keys the mapper never takes: typing in fields, browser and OS shortcuts. */
export function ignoredTarget(
  event: Pick<KeyboardEvent, 'target' | 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>,
): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return true
  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return false
  if (target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) {
    return true
  }
  // Space and Enter activate a focused button or link; everything else stays global.
  if (
    (event.key === ' ' || event.key === 'Enter') &&
    target.closest('button, a, [role="button"], [role="menuitem"], [role="tab"], [role="switch"]')
  ) {
    return true
  }
  // Popups (menus, dialogs, sheets) own their keys.
  return Boolean(target.closest('[role="dialog"], [role="menu"], [role="listbox"]'))
}

export function readLearnedKeys(storage: Pick<Storage, 'getItem'> | undefined): LearnedKeys {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEYS_STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([action, key]) =>
          (ACTIONS as readonly string[]).includes(action) && typeof key === 'string',
      ),
    ) as LearnedKeys
  } catch {
    return {}
  }
}
