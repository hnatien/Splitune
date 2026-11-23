import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { BrandMark, Wordmark } from './brand.tsx'
import { CUSTOM_ICONS } from './icons/index.tsx'
import { BOTH_THEMES, contrast, surfaceOf, themeFrames } from './story-kit.tsx'

// Doc 26 §11, s47 direction §5: the lowercase wordmark (a logotype at 500, outside the type scale)
// and the ink disc crossed by a wave in the page colour; the custom icons on Lucide's grid at
// 1.8 px in currentColor. The PWA icons and favicon below draw the same mark.
const meta = { title: 'Brand/Marks and icons' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const Marks = () => (
  <div className="flex flex-col gap-8">
    <div className="flex flex-wrap items-center gap-8">
      <Wordmark />
      <Wordmark tone="mono" />
      <BrandMark />
      <BrandMark className="size-16" />
      <BrandMark tone="mono" className="size-16" />
    </div>
    <div className="flex flex-wrap items-end gap-6">
      {[
        ['App icon', '/icons/icon.svg'],
        ['Maskable', '/icons/icon-maskable.svg'],
        ['Mono', '/icons/icon-mono.svg'],
        ['Favicon', '/favicon.svg'],
      ].map(([label, src]) => (
        <figure key={src} className="m-0 flex flex-col items-center gap-2">
          <img src={src} alt="" className="size-24 rounded-panel border border-border bg-paper" />
          <figcaption className="text-body-sm text-muted-foreground">{label}</figcaption>
        </figure>
      ))}
      <figure className="m-0 flex flex-col items-center gap-2">
        <span className="flex items-end gap-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <img src="/favicon.svg" alt="" className="size-4" />
        </span>
        <figcaption className="text-body-sm text-muted-foreground">32 / 16</figcaption>
      </figure>
    </div>
  </div>
)

const Icons = () => (
  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4 p-0">
    {Object.entries(CUSTOM_ICONS).map(([name, Icon]) => (
      <li key={name} className="flex flex-col items-center gap-3 border-b border-border p-4">
        <span className="flex items-end gap-3">
          <Icon aria-hidden className="size-4" />
          <Icon aria-hidden className="size-5" />
          <Icon aria-hidden className="size-6" />
          <Icon aria-hidden className="size-8" />
        </span>
        <span className="text-body-sm">{name.replace(/Icon$/, '')}</span>
      </li>
    ))}
  </ul>
)

const checkMarks: Story['play'] = async ({ canvasElement }) => {
  for (const frame of themeFrames(canvasElement)) {
    // The name is real text at one of the two weights.
    const word = [...frame.querySelectorAll('span')].find((span) =>
      span.textContent?.endsWith('splitune'),
    ) as HTMLElement
    await expect(getComputedStyle(word).fontWeight).toBe('500')
    // The disc is the ink (≥ 3:1 on the page) and the wave the page colour on it.
    const disc = frame.querySelector('svg circle') as SVGCircleElement
    const wave = frame.querySelector('svg path') as SVGPathElement
    await expect(contrast(getComputedStyle(disc).fill, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
    await expect(
      contrast(getComputedStyle(wave).stroke, getComputedStyle(disc).fill),
    ).toBeGreaterThanOrEqual(3)
  }
}

const checkIcons: Story['play'] = async ({ canvasElement }) => {
  for (const frame of themeFrames(canvasElement)) {
    for (const icon of frame.querySelectorAll('li svg')) {
      // Lucide's stroke in currentColor, so an icon takes the colour of the text it sits in.
      await expect(icon.getAttribute('stroke')).toBe('currentColor')
      await expect(icon.getAttribute('stroke-width')).toBe('1.8')
    }
  }
}

export const Wordmarks: Story = { render: Marks, play: checkMarks }
export const CustomIcons: Story = { render: Icons, play: checkIcons }
export const BothThemes: Story = { render: Marks, globals: BOTH_THEMES, play: checkMarks }
export const IconsBothThemes: Story = { render: Icons, globals: BOTH_THEMES, play: checkIcons }
export const IconsStage: Story = { render: Icons, globals: { appearance: 'stage' } }
