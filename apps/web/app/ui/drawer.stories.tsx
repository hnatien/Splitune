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
import { DAYLIGHT } from './story-kit.tsx'

// Doc 26 §12.1: bottom sheets with a 40 × 5 grabber and 22 px top corners (the phone sheets' 24
// has no radius token; 22 is the sheet radius), side drawers for the inspector.
const meta = { title: 'Base/Drawer' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const MixerDrawer = ({ side }: { side: 'down' | 'right' }) => (
  <Drawer swipeDirection={side} showSwipeHandle={side === 'down'}>
    <DrawerTrigger render={<Button variant="outline" />}>Mixer</DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Mixer</DrawerTitle>
        <DrawerDescription>Balance the stems. Your part is listed first.</DrawerDescription>
      </DrawerHeader>
      <div className="p-6">Stem rows go here.</div>
      <DrawerFooter>
        <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
)

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Mixer' }))
  const drawer = await screen.findByRole('dialog', { name: 'Mixer' })
  await waitFor(() => expect(drawer).toBeVisible())
}

export const Closed: Story = { render: () => <MixerDrawer side="down" /> }
export const Bottom: Story = { render: () => <MixerDrawer side="down" />, play: open }
export const Side: Story = { render: () => <MixerDrawer side="right" />, play: open }
export const SideDaylight: Story = { ...Side, globals: DAYLIGHT }
export const BottomDaylight: Story = { ...Bottom, globals: DAYLIGHT }
export const BottomStage: Story = { ...Bottom, globals: { appearance: 'stage' } }

/** Bottom sheet: 22 px top corners and a 40 × 5 px grab handle. */
export const BottomSheetShape: Story = {
  render: () => <MixerDrawer side="down" />,
  play: async (context) => {
    await open(context)
    const popup = document.querySelector<HTMLElement>('[data-slot=drawer-popup]')
    const handle = document.querySelector<HTMLElement>('[data-slot=drawer-swipe-handle]')
    await expect(Number.parseFloat(getComputedStyle(popup as Element).borderTopLeftRadius)).toBe(22)
    const pill = getComputedStyle(handle as Element, '::after')
    await expect(pill.width).toBe('40px')
    await expect(pill.height).toBe('5px')
  },
}
