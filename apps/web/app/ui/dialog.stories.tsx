import type { Meta, StoryObj } from '@storybook/react-vite'
import { TriangleAlertIcon } from 'lucide-react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
import { Input } from './input.tsx'
import { Label } from './label.tsx'
import {
  DAYLIGHT,
  expectFloatingLayer,
  expectFocusRing,
  expectTargets,
  isClear,
  resolve,
} from './story-kit.tsx'

// Doc 26 §12.1 `.sheet` + `.overlay`, s47 direction §4: a dialog is the raised layer with one
// hairline, 20 px corners and the dialog shadow over the scrim. One filled control per dialog: the
// confirm (primary, or the solid destructive button in the delete confirm). Popups are portalled
// to <body>, so each theme is its own story rather than side by side.
const meta = { title: 'Base/Dialog' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const RenameDialog = ({ long = false }: { long?: boolean }) => (
  <Dialog>
    <DialogTrigger render={<Button variant="outline" />}>Rename song</DialogTrigger>
    <DialogContent closeLabel={COPY.close}>
      <DialogHeader>
        <DialogTitle>Rename song</DialogTitle>
        <DialogDescription>
          The new name shows in your library and on the practice screen.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="song-name">Name</Label>
        <Input id="song-name" defaultValue="Riff in A minor" />
      </div>
      {long &&
        Array.from({ length: 24 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static filler paragraphs
          <p key={i} className="text-body text-muted-foreground">
            Section {i + 1}: the name is kept with every loop, clip and fix you make in this song.
          </p>
        ))}
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
        <AlertDialogMedia>
          <TriangleAlertIcon aria-hidden />
        </AlertDialogMedia>
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

const openRename = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename song' }))
  const dialog = await screen.findByRole('dialog', { name: 'Rename song' })
  await waitFor(() => expect(dialog).toBeVisible())
  // Wait for the enter animation, so measurements see the resting state.
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  return dialog
}

/** The filled controls in a layer: the one primary (or solid destructive) action. */
const filled = (layer: HTMLElement) =>
  [...layer.querySelectorAll('button[data-variant]')].filter((button) =>
    ['primary', 'destructiveSolid'].includes(button.getAttribute('data-variant') ?? ''),
  )

export const Closed: Story = { render: () => <RenameDialog /> }

export const Open: Story = {
  render: () => <RenameDialog />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename song' })
    const dialog = await openRename(canvasElement)
    await expectFloatingLayer(dialog, '--elevation-dialog', '--radius-dialog')
    await expect(filled(dialog)).toHaveLength(1)
    // Focus moves into the dialog; the corner close button is a full target.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await expectTargets([within(dialog).getByRole('button', { name: COPY.close })])
    // Escape closes it and hands focus back to the trigger.
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

/** Keyboard focus inside the dialog: the ink outline stays visible on the raised surface. */
export const OpenFocus: Story = {
  render: () => <RenameDialog />,
  play: async ({ canvasElement }) => {
    const dialog = await openRename(canvasElement)
    const field = within(dialog).getByRole('textbox', { name: 'Name' })
    field.focus()
    await userEvent.tab()
    const focused = document.activeElement as HTMLElement
    await expect(dialog.contains(focused)).toBe(true)
    await expectFocusRing(focused)
  },
}
export const OpenFocusDaylight: Story = { ...OpenFocus, globals: DAYLIGHT }

/** Left open: the visual row in each appearance. */
const leaveOpen: Story['play'] = async ({ canvasElement }) => {
  const dialog = await openRename(canvasElement)
  await expectFloatingLayer(dialog, '--elevation-dialog', '--radius-dialog')
}
export const OpenNight: Story = {
  name: 'Open dark',
  render: () => <RenameDialog />,
  play: leaveOpen,
}
export const OpenDaylight: Story = {
  render: () => <RenameDialog />,
  globals: DAYLIGHT,
  play: leaveOpen,
}
export const OpenIncreasedContrast: Story = {
  render: () => <RenameDialog />,
  globals: { appearance: 'light', contrast: 'more' },
  play: leaveOpen,
}

/** Long content scrolls inside the dialog, which never runs past the viewport. */
export const LongContent: Story = {
  render: () => <RenameDialog long />,
  play: async ({ canvasElement }) => {
    const dialog = await openRename(canvasElement)
    const box = dialog.getBoundingClientRect()
    await expect(box.top).toBeGreaterThanOrEqual(0)
    await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight)
    const save = within(dialog).getByRole('button', { name: 'Save name' })
    save.scrollIntoView()
    await expect(save).toBeVisible()
  },
}

const openAlert = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: COPY.deleteSong }))
  const dialog = await screen.findByRole('alertdialog')
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  return dialog
}

/**
 * The delete confirm (doc 26 §13): the same layer, a warning glyph with no tinted box, and the
 * solid destructive button as its only fill.
 */
export const Alert: Story = {
  render: DeleteDialog,
  play: async ({ canvasElement }) => {
    const dialog = await openAlert(canvasElement)
    await expectFloatingLayer(dialog, '--elevation-dialog', '--radius-dialog')
    await expect(within(dialog).getByRole('button', { name: COPY.cancel })).toBeVisible()
    await expect(filled(dialog)).toHaveLength(1)
    await expect(filled(dialog)[0]).toHaveAccessibleName(COPY.deleteSong)
    const media = dialog.querySelector('[data-slot=alert-dialog-media]') as HTMLElement
    await expect(isClear(getComputedStyle(media).backgroundColor)).toBe(true)
    await expect(getComputedStyle(media).color).toBe(
      resolve(media, 'backgroundColor', '--destructive'),
    )
    await expectTargets(within(dialog).getAllByRole('button'))
  },
}
export const AlertDaylight: Story = { ...Alert, globals: DAYLIGHT }
export const AlertStage: Story = { ...Alert, globals: { appearance: 'stage' } }

/** The scrim is the theme's own (70 % black on Dark and Stage, 50 % on Light). */
export const OpenScrim: Story = {
  render: () => <RenameDialog />,
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await openRename(canvasElement)
    const overlay = document.querySelector<HTMLElement>('[data-slot=dialog-overlay]')
    await expect(overlay).not.toBeNull()
    const scrim = overlay as HTMLElement
    await waitFor(() => expect(getComputedStyle(scrim).opacity).toBe('1'))
    await expect(getComputedStyle(scrim).backgroundColor).toBe(
      resolve(scrim, 'backgroundColor', '--scrim'),
    )
    await expect(getComputedStyle(scrim).backgroundColor).toMatch(/0\.7\)$/)
  },
}
export const OpenScrimDaylight: Story = {
  render: () => <RenameDialog />,
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    await openRename(canvasElement)
    const scrim = document.querySelector<HTMLElement>('[data-slot=dialog-overlay]') as HTMLElement
    await expect(getComputedStyle(scrim).backgroundColor).toMatch(/0\.5\)$/)
  },
}
