import { expect } from 'storybook/test'

// Shared by the public pages' stories (marketing, auth, billing, system, their shells): the three
// widths every public screen is checked at, and the checks of the s47 direction that hold on all
// of them.

export const VIEWPORTS = {
  desktop1440: {
    name: 'Desktop 1440',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  tablet768: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
  phone375: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
}

export const DESKTOP = { viewport: { value: 'desktop1440', isRotated: false } }
export const TABLET = { viewport: { value: 'tablet768', isRotated: false } }
export const PHONE = { viewport: { value: 'phone375', isRotated: false } }
export const DAYLIGHT = { appearance: 'light' }

/** Nothing on the page scrolls sideways. */
export async function noSidewaysScroll(canvasElement: HTMLElement) {
  const root = canvasElement.ownerDocument.documentElement
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
}

/** On screen now: rendered, not transparent, and bigger than a visually hidden 1 px box. */
const shown = (element: Element) => {
  const { width, height } = element.getBoundingClientRect()
  return (
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    width > 1 &&
    height > 1
  )
}

/**
 * The filled ink controls a visitor can use: one per view (26 §4.5). Pictures of the app (an
 * element with role="img") are left out, since their Play is part of what they show.
 */
export function filledControls(root: ParentNode): Element[] {
  // The skip link is filled too, but sits above the page until it has focus.
  return [...root.querySelectorAll('a.bg-primary, button.bg-primary')].filter(
    (element) =>
      shown(element) && !element.closest('[role=img]') && element.getAttribute('href') !== '#main',
  )
}

/**
 * Every word drawn in a visible picture of the tab renders at 11 px or more (26 §6.2): the SVG's
 * text is scaled by the width it is drawn at, so a picture that narrows must show fewer bars.
 */
export async function expectReadablePictures(root: ParentNode) {
  const svgs = [...root.querySelectorAll('[role=img] svg[viewBox]')].filter(
    (svg): svg is SVGSVGElement => svg instanceof SVGSVGElement && shown(svg),
  )
  let checked = 0
  for (const svg of svgs) {
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
    for (const text of svg.querySelectorAll('text')) {
      const size = Number.parseFloat(getComputedStyle(text).fontSize) * scale
      await expect(size).toBeGreaterThanOrEqual(11)
      checked += 1
    }
  }
  await expect(checked).toBeGreaterThan(0)
}
