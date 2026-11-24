import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer.tsx'
import { ScrollArea } from './scroll-area.tsx'
import { DAYLIGHT, expectTargets, resolve, shadowsOf } from './story-kit.tsx'

// Doc 26 §12.1, s47 direction §6: sheets are floating layers (the raised surface, one hairline on
// the edge facing the page, 20 px corners on that side, the dialog shadow). The phone's tools sheet
// rises from the bottom with a grab handle; a side sheet slides in from the right. Portalled, so
// each theme is its own story.
const meta = { title: 'Base/Drawer' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const MixerDrawer = ({ side, long = false }: { side: 'down' | 'right'; long?: boolean }) => (
  <Drawer swipeDirection={side} showSwipeHandle={side === 'down'}>
    <DrawerTrigger render={<Button variant="outline" />}>Mixer</DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Mixer</DrawerTitle>
        <DrawerDescription>Balance the stems. Your part is listed first.</DrawerDescription>
      </DrawerHeader>
      <ScrollArea className="min-h-0 flex-1" tabIndex={0} aria-label="Stems">
        <ul className="m-0 flex list-none flex-col gap-3 p-6">
          {(long
            ? Array.from({ length: 30 }, (_, i) => `Stem ${i + 1}`)
            : ['Your part', 'Bass', 'Drums']
          ).map((name) => (
            <li key={name} className="border-b border-border pb-3 text-label">
              {name}
            </li>
          ))}
        </ul>
      </ScrollArea>
      <DrawerFooter>
        <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
)

const open = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Mixer' }))
  const drawer = await screen.findByRole('dialog', { name: 'Mixer' })
  await waitFor(() => expect(drawer).toBeVisible())
  const popup = document.querySelector('[data-slot=drawer-popup]') as HTMLElement
  // Wait for the slide-in to settle at its resting place.
  await waitFor(() =>
    expect(getComputedStyle(popup).transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/),
  )
  return popup
}

/** The sheet as a floating layer: raised surface, a hairline on its open edge, the dialog shadow. */
const expectSheet = async (popup: HTMLElement, edge: 'Top' | 'Left') => {
  const style = getComputedStyle(popup)
  await expect(style.backgroundColor).toBe(resolve(popup, 'backgroundColor', '--raised'))
  await expect(style[`border${edge}Width`]).toBe('1px')
  await expect(shadowsOf(popup).filter((shadow) => !shadow.inset).length).toBe(2)
  await expect(style.borderTopLeftRadius).toBe(
    resolve(popup, 'borderTopLeftRadius', '--radius-dialog'),
  )
}

export const Closed: Story = { render: () => <MixerDrawer side="down" /> }

/** Bottom sheet: 20 px top corners, a top hairline and a 40 × 5 grab handle. */
export const Bottom: Story = {
  render: () => <MixerDrawer side="down" />,
  play: async ({ canvasElement }) => {
    const popup = await open(canvasElement)
    await expectSheet(popup, 'Top')
    await expect(popup.getBoundingClientRect().bottom).toBeCloseTo(window.innerHeight, 0)
    const handle = document.querySelector('[data-slot=drawer-swipe-handle]') as HTMLElement
    const pill = getComputedStyle(handle, '::after')
    await expect(pill.width).toBe('40px')
    await expect(pill.height).toBe('5px')
    await expect(pill.backgroundColor).toBe(resolve(handle, 'backgroundColor', '--edge'))
    await expectTargets([within(popup).getByRole('button', { name: 'Done' })])
  },
}
export const BottomDaylight: Story = { ...Bottom, globals: DAYLIGHT }
export const BottomStage: Story = { ...Bottom, globals: { appearance: 'stage' } }

/** Side sheet: from the right, with its hairline and 20 px corners on the left. */
export const Side: Story = {
  render: () => <MixerDrawer side="right" />,
  play: async ({ canvasElement }) => {
    const popup = await open(canvasElement)
    await expectSheet(popup, 'Left')
    await expect(popup.getBoundingClientRect().right).toBeCloseTo(window.innerWidth, 0)
  },
}
export const SideDaylight: Story = { ...Side, globals: DAYLIGHT }

/** Escape closes the sheet and returns focus to what opened it. */
export const Dismiss: Story = {
  render: () => <MixerDrawer side="down" />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Mixer' })
    await open(canvasElement)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

/** Long content scrolls inside the sheet, which stops short of the top of the screen. */
export const LongContent: Story = {
  render: () => <MixerDrawer side="down" long />,
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    const popup = await open(canvasElement)
    await expect(popup.getBoundingClientRect().top).toBeGreaterThan(0)
    await expect(within(popup).getByRole('button', { name: 'Done' })).toBeVisible()
  },
}
