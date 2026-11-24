// Which control holds focus only because a pointer pressed it (keymap.ts: there Space and Enter
// stay the practice keys, so Space still plays after a click on Loop or a panel tab).
//
// `:focus-visible` says the same in Chromium and WebKit, but not in Firefox, which withholds it
// from a control the app focuses itself: after J, Fix puts focus on "It's right", and Enter there
// played the song instead of pressing the button. So the pointer is watched directly: a control
// is the pointer's from the press on it until focus leaves it or Tab moves focus by keyboard.

/** The controls Space and Enter press when the keyboard is on them. */
export const CONTROLS =
  'button, a, [role="button"], [role="menuitem"], [role="tab"], [role="switch"]'

let pressed: unknown = null

export const pointerFocus = {
  /** A pointer went down on this element, or inside it. */
  press(target: EventTarget | null) {
    const element = target as { closest?: (selector: string) => unknown } | null
    pressed = typeof element?.closest === 'function' ? element.closest(CONTROLS) : null
  },
  /** Focus left this element. */
  leave(target: EventTarget | null) {
    if (target === pressed) pressed = null
  },
  /** Tab moved focus: wherever it lands, the keyboard put it there. */
  tab() {
    pressed = null
  },
  /** Whether this control has focus from a pointer press, not from the keyboard or the app. */
  holds(control: unknown): boolean {
    return control !== null && control === pressed
  },
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (event) => pointerFocus.press(event.target), true)
  document.addEventListener('focusout', (event) => pointerFocus.leave(event.target), true)
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') pointerFocus.tab()
    },
    true,
  )
}
