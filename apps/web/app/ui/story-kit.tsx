import Color from 'colorjs.io'
import type * as React from 'react'
import { expect } from 'storybook/test'

// Shared pieces for the base-component stories (docs/specs/28-ui-quality-and-design-review.md §2,
// §3): both themes side by side, a labelled grid of states, and the target-size probe. Stories
// only; nothing in the app imports this.

/** Story globals: the story twice, in Dark and Light subtrees (preview.tsx). */
export const BOTH_THEMES = { appearance: 'side-by-side' } as const
export const BOTH_THEMES_MORE_CONTRAST = { appearance: 'side-by-side', contrast: 'more' } as const
export const DAYLIGHT = { appearance: 'light' } as const

/** The Dark and Light frames of a side-by-side story (or the one frame otherwise). */
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
          <figcaption className="text-caption text-faint-foreground">{label}</figcaption>
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

/** WCAG 2.x contrast of two computed CSS colours (any syntax the browser serialises). */
export function contrast(a: string, b: string): number {
  return new Color(a).contrast(new Color(b), 'WCAG21')
}

const transparent = (color: string) => new Color(color).alpha.valueOf() === 0

/** Whether a computed colour paints nothing (no fill, no line). */
export function isClear(color: string): boolean {
  return transparent(color)
}

/** The colour an element is painted on: its own background, or the nearest ancestor's. */
export function surfaceOf(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const background = getComputedStyle(node).backgroundColor
    if (!transparent(background)) return background
  }
  return getComputedStyle(document.body).backgroundColor
}

type Shadow = { color: string; y: number; blur: number; spread: number; inset: boolean }

/** The layers of a computed box-shadow, skipping the transparent ones Tailwind composes in. */
export function shadowsOf(element: Element): Shadow[] {
  return parseShadows(getComputedStyle(element).boxShadow)
}

function parseShadows(value: string): Shadow[] {
  if (value === 'none') return []
  // Split on the commas between layers, not the ones inside a colour function.
  return value.split(/,(?![^(]*\))/).flatMap((layer) => {
    const color = layer.match(/[a-z]+\([^)]*\)/i)?.[0] ?? ''
    const lengths = [...layer.replace(color, '').matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]))
    if (!color || transparent(color)) return []
    return [
      {
        color,
        y: lengths[1] ?? 0,
        blur: lengths[2] ?? 0,
        spread: lengths[3] ?? 0,
        inset: /inset/.test(layer),
      },
    ]
  })
}

/** A shadow's drop layers as comparable numbers: offset, blur and the shade's alpha. */
const dropLayers = (shadows: Shadow[]) =>
  shadows
    .filter((shadow) => !shadow.inset)
    .map((shadow) => [shadow.y, shadow.blur, new Color(shadow.color).alpha.valueOf().toFixed(2)])

/** The inset ring a control draws as its edge (Tailwind's `inset-ring-*`), if it has one. */
export function edgeOf(element: Element): { width: number; color: string } | undefined {
  const ring = shadowsOf(element).find((shadow) => shadow.inset && shadow.blur === 0)
  return ring && { width: ring.spread, color: ring.color }
}

/**
 * The selection rule of the s47 system: "on" is a 1.5 px ink edge at ≥ 3:1 against the surface
 * the control sits on, and the control's own surface stays that surface (no grey fill).
 */
export async function expectInkEdge(element: Element, width = 1.5) {
  const edge = edgeOf(element)
  await expect(edge?.width, 'ink edge width').toBe(width)
  await expect(
    contrast(edge?.color ?? 'transparent', surfaceOf(element.parentElement ?? element)),
  ).toBeGreaterThanOrEqual(3)
}

/** A floating layer: the raised surface, one hairline, the given shadow and radius tokens. */
export async function expectFloatingLayer(
  element: Element,
  shadow: '--elevation-popover' | '--elevation-dialog',
  radius: '--radius-panel' | '--radius-dialog',
) {
  const style = getComputedStyle(element)
  await expect(style.backgroundColor, 'surface').toBe(
    resolve(element, 'backgroundColor', '--raised'),
  )
  await expect(style.borderTopWidth, 'hairline').toBe('1px')
  await expect(style.borderTopStyle).toBe('solid')
  await expect(style.borderTopLeftRadius, 'radius').toBe(
    resolve(element, 'borderTopLeftRadius', radius),
  )
  await expect(dropLayers(shadowsOf(element)), 'shadow').toEqual(
    dropLayers(parseShadows(resolve(element, 'boxShadow', shadow))),
  )
}

/** A token's computed value for one CSS property, in the cascade of `context`. */
export function resolve(
  context: Element,
  property: 'backgroundColor' | 'borderTopLeftRadius' | 'boxShadow',
  token: string,
): string {
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style[property] = `var(${token})`
  ;(context.parentElement ?? context).append(probe)
  const value = getComputedStyle(probe)[property]
  probe.remove()
  return value
}

/** The 2 px ink focus outline (3 px under increased contrast) at ≥ 3:1 against the surface. */
export async function expectFocusRing(element: Element, width = '2px') {
  const style = getComputedStyle(element)
  await expect(style.outlineStyle).toBe('solid')
  await expect(style.outlineWidth).toBe(width)
  // An outline drawn over the control's painted face sits on the control; one outside that face
  // (past the box, or in a transparent padding border) sits on what is around it.
  const painted =
    style.backgroundClip === 'padding-box' ? Number.parseFloat(style.borderTopWidth) : 0
  const inside = -Number.parseFloat(style.outlineOffset) > painted
  const ground = inside ? element : (element.parentElement ?? element)
  await expect(contrast(style.outlineColor, surfaceOf(ground))).toBeGreaterThanOrEqual(3)
}
