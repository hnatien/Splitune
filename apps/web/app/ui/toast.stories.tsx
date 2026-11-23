import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { COPY } from './fixtures.ts'
import { DAYLIGHT, expectFloatingLayer, expectTargets, resolve } from './story-kit.tsx'
import { Toaster, toast } from './toast.tsx'

// Doc 26 §12.1 `.toast`, s47 direction §4: a floating layer (the raised surface, one hairline,
// 14 px corners, the popover shadow); an error toast's hairline is --destructive beside its glyph.
// A toast with an action (Undo) never times out.
const meta = { title: 'Base/Toast' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const Demo = () => (
  <Toaster closeLabel={COPY.close}>
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: 'Loop saved as "Solo bars 17–20"',
            type: 'success',
            actionProps: { children: COPY.undo },
          })
        }
      >
        Save loop
      </Button>
      <Button variant="outline" onClick={() => toast.add({ title: 'Song renamed', type: 'info' })}>
        Rename song
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: "Couldn't save the edit",
            description: 'The change is undone. Try again.',
            type: 'error',
          })
        }
      >
        Fail a save
      </Button>
    </div>
  </Toaster>
)

export const Idle: Story = { render: Demo }

const toastOf = (element: HTMLElement) => element.closest('[data-slot="toast"]') as HTMLElement

export const WithUndo: Story = {
  render: Demo,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save loop' }))
    const undo = await screen.findByRole('button', { name: COPY.undo })
    await waitFor(() => expect(undo).toBeVisible())
    const root = toastOf(undo)
    await waitFor(() => expect(getComputedStyle(root).opacity).toBe('1'))
    await expectFloatingLayer(root, '--elevation-popover', '--radius-panel')
    const close = root.querySelector('[data-slot=toast-close]') as HTMLElement
    // Base UI hides the close button from assistive tech until the stack is expanded or focused;
    // its label is still there for when it is reached.
    await expect(close).toHaveAttribute('aria-label', COPY.close)
    await expectTargets([undo, close])
    // Undo is an outline action, not a second fill.
    await expect(undo).toHaveAttribute('data-variant', 'outline')
  },
}

export const WithUndoDaylight: Story = { ...WithUndo, globals: DAYLIGHT }

const openError = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Fail a save' }))
  const title = await screen.findByText("Couldn't save the edit")
  await waitFor(() => expect(title).toBeVisible())
  const toastRoot = toastOf(title)
  await expect(getComputedStyle(toastRoot).borderTopLeftRadius).toBe(
    resolve(toastRoot, 'borderTopLeftRadius', '--radius-panel'),
  )
  // The error keeps the raised surface; its hairline and glyph carry the tone.
  await expect(getComputedStyle(toastRoot).backgroundColor).toBe(
    resolve(toastRoot, 'backgroundColor', '--raised'),
  )
  await expect(getComputedStyle(toastRoot).borderTopColor).toBe(
    resolve(toastRoot, 'backgroundColor', '--destructive'),
  )
  await expect(toastRoot.querySelector('[data-slot=toast-icon] svg')).not.toBeNull()
}
export const ErrorState: Story = { render: Demo, play: openError }
export const ErrorDaylight: Story = { ...ErrorState, globals: DAYLIGHT }
export const WithUndoStage: Story = { ...WithUndo, globals: { appearance: 'stage' } }

/** Several toasts stack with the newest in front; each keeps its own close button. */
export const Stacked: Story = {
  render: Demo,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Rename song' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save loop' }))
    await waitFor(() => expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(2))
  },
}
