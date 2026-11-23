// Bar numbers as the learner counts them (27 §3.7.1): from the first full bar. alphaTab numbers
// its bars from 1 at its own first bar, which is a song's pickup when it has one, so the printed
// numbers ran one ahead of the loop label, the position and every other bar the app names. The
// view rewrites alphaTab's printed numbers with these: its bar i is grid bar `firstBar + i`, shown
// as `firstBar + i + 1`, and a pickup (grid bar −1, shown as 0) prints no number.

/** alphaTab prints a bar number as the number followed by two spaces; nothing else it draws is. */
const PRINTED = /^(\d+) {2}$/

/** The number alphaTab printed for a bar (1-based from its first bar), or null for other text. */
export function printedBarNumber(text: string): number | null {
  const match = PRINTED.exec(text)
  return match ? Number(match[1]) : null
}

/** What to print for the bar alphaTab numbered `printed`: the grid's 1-based number, or nothing
 * for a pickup. */
export function barNumberText(printed: number, firstBar: number): string {
  const shown = printed + firstBar
  return shown > 0 ? `${shown}  ` : ''
}

/**
 * Rewrites the bar numbers under `root` (alphaTab's SVG output, in whole or a chunk of it) for a
 * score whose first bar is grid bar `firstBar`. The printed number is kept on the element, so a
 * second pass, or a pass after the grid changed, starts from what alphaTab drew.
 */
export function renumberBars(root: ParentNode, firstBar: number): void {
  for (const text of root.querySelectorAll('text')) {
    const kept = text.getAttribute('data-printed-bar')
    const printed = kept === null ? printedBarNumber(text.textContent ?? '') : Number(kept)
    if (printed === null) continue
    if (kept === null) text.setAttribute('data-printed-bar', String(printed))
    const next = barNumberText(printed, firstBar)
    if (text.textContent !== next) text.textContent = next
  }
}
