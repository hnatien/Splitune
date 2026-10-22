// Hands-busy input (12 §8): the default keys page-turner pedals send, plus keys learned per
// device ("Learn this pedal"). Matching is on KeyboardEvent.key, which pedals report as the key
// they emulate (PageDown, ArrowRight, …).

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
] as const

export type Action = (typeof ACTIONS)[number]

export const DEFAULT_KEYS: Record<Action, string[]> = {
  playPause: [' ', 'Enter'],
  restart: ['ArrowLeft', 'PageUp'],
  next: ['ArrowRight', 'PageDown'],
  slower: ['ArrowDown'],
  faster: ['ArrowUp'],
  clean: ['c'],
  notYet: ['n'],
  toggleLoop: ['l'],
  mutePart: ['m'],
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
