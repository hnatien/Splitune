import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { COPY } from './fixtures.ts'
import { Toaster, toast } from './toast.tsx'

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

export const WithUndoDark: Story = { ...WithUndo, globals: { appearance: 'dark' } }
export const WithUndoStage: Story = { ...WithUndo, globals: { appearance: 'stage' } }
