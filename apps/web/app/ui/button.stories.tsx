import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayIcon, Trash2Icon } from 'lucide-react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'

const meta = {
  title: 'Base/Button',
  component: Button,
  args: { children: 'Start practising', onClick: fn() },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { variant: 'primary' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: (
      <>
        <Trash2Icon aria-hidden />
        Delete song
      </>
    ),
  },
}
export const Link: Story = { args: { variant: 'link', children: 'See supported browsers' } }

export const Hover: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'))
  },
}

export const Focus: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const button = within(canvasElement).getByRole('button')
    await expect(button).toHaveFocus()
    const style = getComputedStyle(button)
    await expect(style.outlineStyle).toBe('solid')
    await expect(style.outlineWidth).toBe('2px')
  },
}

export const FocusIncreasedContrast: Story = {
  ...Focus,
  globals: { contrast: 'more' },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(getComputedStyle(within(canvasElement).getByRole('button')).outlineWidth).toBe(
      '3px',
    )
  },
}

export const Pressed: Story = {
  args: { variant: 'secondary' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

export const Disabled: Story = { args: { variant: 'primary', disabled: true } }

export const Loading: Story = {
  args: { variant: 'primary', loading: true, children: 'Email me a link' },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button')
    await expect(button).toHaveAttribute('aria-busy', 'true')
    const width = button.getBoundingClientRect().width
    const label = within(canvasElement).getByText('Email me a link')
    // The spinner replaces the label only after 300 ms, and the button keeps its width.
    await expect(label).toBeVisible()
    await waitFor(() => expect(label).not.toBeVisible())
    await expect(button.getBoundingClientRect().width).toBe(width)
    // Still focusable (focusableWhenDisabled) so focus isn't lost, but Enter does nothing.
    button.focus()
    await userEvent.keyboard('{Enter}')
    await expect(button).toHaveFocus()
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const Invalid: Story = {
  args: { variant: 'outline', 'aria-invalid': true, children: 'Choose a file' },
}

/** Doc 26 §8: practice 64, practice-2 48, browse 44 (48 in practice density), sm 32 desktop only. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" size="icon-practice" aria-label="Play">
        <PlayIcon aria-hidden />
      </Button>
      <Button {...args} size="practice">
        Felt clean
      </Button>
      <Button {...args} size="practice-2">
        Count-in
      </Button>
      <Button {...args} size="md">
        Import a song
      </Button>
      <Button {...args} size="sm">
        Details
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [play, practice, practice2, browse, small] = within(canvasElement)
      .getAllByRole('button')
      .map((button) => button.getBoundingClientRect())
    await expect(play?.width).toBeGreaterThanOrEqual(64)
    await expect(play?.height).toBeGreaterThanOrEqual(64)
    await expect(practice?.height).toBeGreaterThanOrEqual(64)
    await expect(practice2?.height).toBeGreaterThanOrEqual(48)
    await expect(browse?.height).toBeGreaterThanOrEqual(44)
    await expect(small?.height).toBeGreaterThanOrEqual(32)
  },
}

export const SizesPracticeDensity: Story = {
  ...Sizes,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const browse = within(canvasElement).getByRole('button', { name: 'Import a song' })
    await expect(browse.getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
  },
}

const Gallery = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary">Start practising</Button>
    <Button variant="secondary">Not now</Button>
    <Button variant="outline">Try another file</Button>
    <Button variant="ghost">Details</Button>
    <Button variant="destructive">Delete song</Button>
    <Button variant="link">See Plus</Button>
    <Button variant="primary" disabled>
      Unavailable
    </Button>
    <Button variant="outline" disabled>
      Unavailable
    </Button>
  </div>
)

export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }
