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
        <AlertDialogAction variant="destructive">{COPY.deleteSong}</AlertDialogAction>
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

export const OpenDark: Story = {
  render: RenameDialog,
  globals: { appearance: 'dark' },
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

export const AlertStage: Story = { ...Alert, globals: { appearance: 'stage' } }

export const OpenScrim: Story = {
  render: RenameDialog,
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename song' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename song' })
    const overlay = document.querySelector<HTMLElement>('[data-slot=dialog-overlay]')
    await expect(overlay).not.toBeNull()
    await expect(getComputedStyle(overlay as Element).backgroundColor).toMatch(/\/ 0\.6\)$/)
    await expect(Number.parseFloat(getComputedStyle(dialog).borderTopLeftRadius)).toBeGreaterThan(
      16,
    )
  },
}
