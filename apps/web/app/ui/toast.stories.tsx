import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { COPY } from './fixtures.ts'
import { DAYLIGHT } from './story-kit.tsx'
import { Toaster, toast } from './toast.tsx'

// Doc 26 §12.1 `.toast`: an --accent chip with a --border-strong edge, 14 px corners and
// --elevation-2; an error toast has a --destructive edge as well as its icon.
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

export const WithUndo: Story = {
  render: Demo,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save loop' }))
    const undo = await screen.findByRole('button', { name: COPY.undo })
    await waitFor(() => expect(undo).toBeVisible())
  },
}

export const WithUndoDaylight: Story = { ...WithUndo, globals: DAYLIGHT }

const openError = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Fail a save' }))
  const title = await screen.findByText("Couldn't save the edit")
  await waitFor(() => expect(title).toBeVisible())
  const toastRoot = title.closest('[data-slot="toast"]') as HTMLElement
  await expect(getComputedStyle(toastRoot).borderTopLeftRadius).toBe('14px')
}
export const ErrorState: Story = { render: Demo, play: openError }
export const ErrorDaylight: Story = { ...ErrorState, globals: DAYLIGHT }
export const WithUndoStage: Story = { ...WithUndo, globals: { appearance: 'stage' } }
