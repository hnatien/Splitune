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
export const SideDark: Story = { ...Side, globals: { appearance: 'dark' } }
export const BottomStage: Story = { ...Bottom, globals: { appearance: 'stage' } }
