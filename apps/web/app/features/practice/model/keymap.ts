// Hands-busy input (12 §8, 27 §3.7.6): one key or one pedal press for every practice action.
// Matching is on KeyboardEvent.key, which pedals report as the key they emulate (PageDown,
// ArrowRight, …); Shift with an arrow or a digit is its own key ("Shift+ArrowLeft", "Shift+7"),
// read from the physical digit so it works on every layout.
//
// A two-button pedal sends Page Up and Page Down. Left means again and right means go, and what
// that is depends on the moment (input-mapper.ts): play or pause and back to the loop's start;
// after a looped pass, Felt clean and Not yet; in Fix, the next and previous unsure spot.
//
// A loop is one key: 1, 2, 4 or 8 loops that many bars from the bar that's playing, and Shift
// with ← or → moves the loop by its own length. Speed is `,` / `.` (Shift: 1 %) and Shift with
// 5 … 0 for 50 … 100 %. ↑ and ↓, which most pedals send out of the box, never change speed:
// until a pedal is set up they only say "Pedal detected? Set it up". Character keys can be
// switched off (WCAG 2.1.4); the non-character keys pedals send and learned keys keep working.

// In 12 §8's order (Settings → Keyboard & pedal lists them as they come here).
export const ACTIONS = [
  'playPause',
  'pedalRight',
  'pedalLeft',
  'restart',
  'next',
  'fromTop',
  'slower',
  'faster',
  'speed',
  'clean',
  'notYet',
  'toggleLoop',
  'loopBack',
  'loopForward',
  'countIn',
  'mutePart',
  'tools',
  'view',
  'marks',
  'nextUnsure',
  'previousUnsure',
  'fixBar',
  'acceptFix',
  'previousPhrase',
  'nextPhrase',
  'cueNote',
] as const

export type Action = (typeof ACTIONS)[number]

export const DEFAULT_KEYS: Record<Action, string[]> = {
  playPause: [' ', 'Enter'],
  // The pedal's two sides: right means go, left means again.
  pedalRight: ['PageDown'],
  pedalLeft: ['PageUp'],
  restart: ['ArrowLeft'],
  next: ['ArrowRight'],
  fromTop: ['r', 'Home'],
  slower: [','],
  faster: ['.'],
  // Opens the speed panel on its typed field: S, a number, Enter.
  speed: ['s'],
  clean: ['c'],
  notYet: ['n'],
  toggleLoop: ['l'],
  loopBack: ['Shift+ArrowLeft'],
  loopForward: ['Shift+ArrowRight'],
  countIn: ['i'],
  mutePart: ['m'],
  tools: ['x'],
  view: ['v'],
  marks: ['u'],
  // The Fix tab (12 §4): through the unsure spots, and the bar that's playing.
  nextUnsure: ['j'],
  previousUnsure: ['k'],
  fixBar: ['e'],
  // The suggested fix on the selected spot: its first alternative, or "It's right".
  acceptFix: ['y'],
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

/** Loop lengths with a key of their own: the digit loops that many bars from the bar playing. */
export const LOOP_BARS = [1, 2, 4, 8] as const
export type LoopBars = (typeof LOOP_BARS)[number]

/** Speeds with a key of their own: Shift with the digit, 5 … 9 for 50 … 90 % and 0 for 100 %. */
export const SPEED_KEYS: Record<string, number> = {
  'Shift+5': 50,
  'Shift+6': 60,
  'Shift+7': 70,
  'Shift+8': 80,
  'Shift+9': 90,
  'Shift+0': 100,
}

/**
 * A character key shortcut (WCAG 2.1.4): one letter, digit, punctuation or symbol, with or
 * without Shift (Shift with a digit types a symbol). Space, Enter, Home, the arrows and Page
 * Up/Down aren't: pedals send them, and they stay on with single keys off.
 */
export const isCharacterKey = (key: string) =>
  (key.length === 1 && key !== ' ') || /^Shift\+\d$/.test(key)

type KeyInput = Pick<KeyboardEvent, 'key' | 'shiftKey'> & { code?: string }

/**
 * The key as the map knows it. Shift turns `,` and `.` into `<` and `>` on most layouts, so they
 * stay `,` and `.` (a fine speed step). Shift with a digit or with ← / → is a key of its own,
 * taken from the physical digit key because the character Shift types depends on the layout.
 */
export function keyOf(event: KeyInput): string {
  if (event.shiftKey && (event.key === '<' || event.code === 'Comma')) return ','
  if (event.shiftKey && (event.key === '>' || event.code === 'Period')) return '.'
  if (event.shiftKey) {
    const digit = /^Digit(\d)$/.exec(event.code ?? '')?.[1]
    if (digit !== undefined) return `Shift+${digit}`
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return `Shift+${event.key}`
  }
  return event.key
}

export type KeyResult =
  | { kind: 'action'; action: Action; fine: boolean; learned: boolean }
  /** 1, 2, 4 or 8: loop that many bars from the bar that's playing. */
  | { kind: 'loop-bars'; bars: LoopBars }
  /** Shift with 5 … 0: set the speed. */
  | { kind: 'speed'; pct: number }
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
  const bars = LOOP_BARS.find((n) => String(n) === key)
  if (bars !== undefined) return { kind: 'loop-bars', bars }
  const pct = SPEED_KEYS[key]
  if (pct !== undefined) return { kind: 'speed', pct }
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
  // Popups (menus, dialogs, sheets) own their keys, except the practice screen's own sheets (the
  // tools and the bar editor), which sit beside the music: the keys and the pedal keep working
  // there, so a learner can step through unsure spots without closing the sheet.
  const popup = target.closest('[role="dialog"], [role="menu"], [role="listbox"]')
  return popup !== null && !popup.hasAttribute('data-practice-keys')
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
