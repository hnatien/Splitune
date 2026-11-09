import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog.tsx'
import { Button } from './button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog.tsx'
import { COPY } from './fixtures.ts'
import { DAYLIGHT } from './story-kit.tsx'

// Doc 26 §12.1 `.sheet` + `.overlay`: 22 px corners, --elevation-3, the --scrim behind; the delete
// confirm is the one solid destructive button (V9: graphite text on red in Night).
const meta = { title: 'Base/Dialog' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const RenameDialog = () => (
  <Dialog>
    <DialogTrigger render={<Button variant="outline" />}>Rename song</DialogTrigger>
    <DialogContent closeLabel={COPY.close}>
      <DialogHeader>
        <DialogTitle>Rename song</DialogTitle>
        <DialogDescription>
          The new name shows in your library and on the practice screen.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>{COPY.cancel}</DialogClose>
        <DialogClose render={<Button variant="primary" />}>Save name</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

const DeleteDialog = () => (
  <AlertDialog>
    <AlertDialogTrigger render={<Button variant="destructive" />}>
      {COPY.deleteSong}
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{COPY.deleteSong}</AlertDialogTitle>
        <AlertDialogDescription>{COPY.deleteConfirm}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{COPY.cancel}</AlertDialogCancel>
        <AlertDialogAction variant="destructiveSolid">{COPY.deleteSong}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

export const Closed: Story = { render: RenameDialog }

export const Open: Story = {
  render: RenameDialog,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename song' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename song' })
    await waitFor(() => expect(dialog).toBeVisible())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  },
}

/** Open and left open (the visual row). */
export const OpenNight: Story = {
  render: RenameDialog,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename song' }))
    await screen.findByRole('dialog')
  },
}

export const OpenDaylight: Story = {
  render: RenameDialog,
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename song' }))
    await screen.findByRole('dialog')
  },
}

export const Alert: Story = {
  render: DeleteDialog,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: COPY.deleteSong }))
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: COPY.cancel })).toBeVisible(),
    )
  },
}

export const AlertDaylight: Story = { ...Alert, globals: DAYLIGHT }
export const AlertStage: Story = { ...Alert, globals: { appearance: 'stage' } }

export const OpenScrim: Story = {
  render: RenameDialog,
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename song' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename song' })
    const overlay = document.querySelector<HTMLElement>('[data-slot=dialog-overlay]')
    await expect(overlay).not.toBeNull()
    await expect(getComputedStyle(overlay as Element).backgroundColor).toMatch(/\/ 0\.62\)$/)
    await expect(Number.parseFloat(getComputedStyle(dialog).borderTopLeftRadius)).toBe(22)
  },
}
