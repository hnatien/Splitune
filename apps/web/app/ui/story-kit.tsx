import type * as React from 'react'
import { expect } from 'storybook/test'

// Shared pieces for the base-component stories (docs/specs/28-ui-quality-and-design-review.md §2,
// §3): both themes side by side, a labelled grid of states, and the target-size probe. Stories
// only; nothing in the app imports this.

/** Story globals: the story twice, in Night Rehearsal and Daylight subtrees (preview.tsx). */
export const BOTH_THEMES = { appearance: 'side-by-side' } as const
export const BOTH_THEMES_MORE_CONTRAST = { appearance: 'side-by-side', contrast: 'more' } as const
export const DAYLIGHT = { appearance: 'light' } as const

/** The Night Rehearsal and Daylight frames of a side-by-side story (or the one frame otherwise). */
export function themeFrames(canvasElement: HTMLElement): HTMLElement[] {
  const frames = [
    ...canvasElement.querySelectorAll<HTMLElement>(':scope > div > [data-appearance]'),
  ]
  return frames.length > 0 ? frames : [canvasElement]
}

/** One labelled cell per state, so a screenshot names what it shows (G2 evidence). */
export function StateGrid({
  states,
  className,
}: {
  states: [label: string, node: React.ReactNode][]
  className?: string
}) {
  return (
    <div className={className ?? 'flex flex-wrap items-start gap-x-6 gap-y-5'}>
      {states.map(([label, node]) => (
        <figure key={label} className="m-0 flex flex-col items-start gap-2">
          <figcaption className="text-xs tracking-[0.08em] text-faint-foreground uppercase">
            {label}
          </figcaption>
          {node}
        </figure>
      ))}
    </div>
  )
}

type Size = number | { width: number; height: number }

/**
 * 28 §3 target-size row: each control's own border box (getBoundingClientRect, no pseudo-element
 * extension) is at least `min` CSS px wide and tall. Reports every control that falls short.
 */
export async function expectTargets(elements: Iterable<Element>, min: Size = 44) {
  const { width, height } = typeof min === 'number' ? { width: min, height: min } : min
  const short: string[] = []
  let count = 0
  for (const element of elements) {
    count += 1
    const box = element.getBoundingClientRect()
    if (box.width + 0.01 < width || box.height + 0.01 < height) {
      const name =
        element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName
      short.push(`${name}: ${box.width.toFixed(1)} × ${box.height.toFixed(1)}`)
    }
  }
  await expect(count, 'controls measured').toBeGreaterThan(0)
  await expect(short, `targets under ${width} × ${height}`).toEqual([])
}

/** 26 §12.3: disabled controls keep full opacity and say "Unavailable" in their accessible name. */
export async function expectUnavailable(element: Element, name: string) {
  await expect(getComputedStyle(element).opacity).toBe('1')
  await expect(element).toHaveAccessibleName(expect.stringContaining(name))
}
