import type { Meta, StoryObj } from '@storybook/react-vite'
import { MetronomeIcon, PlayIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from 'lucide-react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  expectTargets,
  expectUnavailable,
  StateGrid,
  themeFrames,
} from './story-kit.tsx'

// Doc 26 §12.1 `.btn` / `.ib`, §12.3 states. One amber (primary) button per view (§4.5): every
// story shows at most one.
const meta = {
  title: 'Base/Button',
  component: Button,
  args: { children: 'Start practising', onClick: fn() },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { variant: 'primary' }, globals: BOTH_THEMES }
export const Secondary: Story = { args: { children: 'Save clip' }, globals: BOTH_THEMES }
export const Quiet: Story = {
  args: { variant: 'quiet', children: 'Not now' },
  globals: BOTH_THEMES,
}
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancel' }, globals: BOTH_THEMES }
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
  globals: BOTH_THEMES,
}
/** The confirm button inside a delete dialog only (26 §4.3): graphite text on red in Night (V9). */
export const DestructiveSolid: Story = {
  args: { variant: 'destructiveSolid', children: 'Delete song' },
  globals: BOTH_THEMES,
}
export const Link: Story = {
  args: { variant: 'link', children: 'See supported browsers' },
  globals: BOTH_THEMES,
}

/** Icon buttons: `.ib` at rest, `box` (bordered on the card) and `on` (state in the name). */
export const IconButtons: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={[
        [
          'Icon',
          <Button key="i" variant="ghost" size="icon" aria-label="Close">
            <XIcon aria-hidden />
          </Button>,
        ],
        [
          'Box',
          <Button key="b" variant="box" size="icon" aria-label="Faster">
            <PlusIcon aria-hidden />
          </Button>,
        ],
        [
          'On',
          <Button key="o" variant="on" size="icon" aria-label="Metronome, on" aria-pressed>
            <MetronomeIcon aria-hidden />
          </Button>,
        ],
        [
          'Secondary practice 52',
          <Button key="p2" variant="box" size="icon-practice-2" aria-label="Count-in">
            <MetronomeIcon aria-hidden />
          </Button>,
        ],
        [
          'Disabled',
          <Button key="d" variant="box" size="icon" aria-label="Faster, unavailable" disabled>
            <PlusIcon aria-hidden />
          </Button>,
        ],
      ]}
    />
  ),
}

export const Hover: Story = {
  args: { children: 'Save clip' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button')
    await userEvent.hover(button)
    await expect(button).toBeVisible()
  },
}
export const HoverDaylight: Story = { ...Hover, globals: DAYLIGHT }

/** The primary hover is brightness(1.06), as in the mockup (`.btn.pri:hover`). */
export const HoverPrimary: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button')
    await userEvent.hover(button)
    await expect(button.className).toContain('hover:brightness-106')
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
    // 2 px off the painted face: the transparent pad is 2 px, so the outline sits on the box edge.
    await expect(style.outlineOffset).toBe('0px')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

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
  args: { variant: 'secondary', children: 'Save clip' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

/** 26 §12.3: --muted fill, --faint-foreground text, a ≥ 3:1 edge and "Unavailable" in the name. */
export const Disabled: Story = {
  args: { variant: 'primary', disabled: true, unavailableLabel: 'unavailable' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(button).toBeDisabled()
      await expectUnavailable(button, 'unavailable')
    }
  },
}

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
  args: { variant: 'quiet', 'aria-invalid': true, children: 'Choose a file' },
  globals: BOTH_THEMES,
}

const SIZES = (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary" size="icon-practice" aria-label="Play">
      <PlayIcon aria-hidden />
    </Button>
    <Button size="practice">Felt clean</Button>
    <Button size="practice-2">Count-in</Button>
    <Button size="xl">Resume</Button>
    <Button size="lg">Add song</Button>
    <Button size="md">Import a song</Button>
    <Button size="sm">Details</Button>
    <Button size="icon" variant="ghost" aria-label="More">
      <SaveIcon aria-hidden />
    </Button>
    <Button size="icon-sm" variant="ghost" aria-label="Remove">
      <XIcon aria-hidden />
    </Button>
  </div>
)

/**
 * Doc 26 §8, V12: painted sm 32, md 40, lg 48, xl 56, practice 64; sm, md and the icon sizes sit
 * in a 44 box (48 in practice density) padded with a transparent border.
 */
export const Sizes: Story = {
  render: () => SIZES,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const box = (name: string) => canvas.getByRole('button', { name }).getBoundingClientRect()
    await expect([box('Play').width, box('Play').height]).toEqual([64, 64])
    await expect(box('Felt clean').height).toBe(64)
    await expect(box('Count-in').height).toBe(48)
    await expect(box('Resume').height).toBe(56)
    await expect(box('Add song').height).toBe(48)
    await expect(box('Import a song').height).toBe(44)
    await expect(box('Details').height).toBe(44)
    await expect([box('More').width, box('More').height]).toEqual([44, 44])
    // The painted face: md 40 and sm 32, inside the 44 box.
    const face = (name: string) => {
      const button = canvas.getByRole('button', { name })
      return button.clientHeight
    }
    await expect(face('Import a song')).toBe(40)
    await expect(face('Details')).toBe(32)
    await expect(face('More')).toBe(40)
    await expect(face('Remove')).toBe(32)
    await expectTargets(canvas.getAllByRole('button'), 44)
  },
}

export const SizesPracticeDensity: Story = {
  render: () => SIZES,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const browse = canvas.getByRole('button', { name: 'Import a song' })
    await expect(browse.getBoundingClientRect().height).toBe(48)
    await expect(browse.clientHeight).toBe(40)
    await expectTargets(canvas.getAllByRole('button'), 48)
  },
}

const Gallery = () => (
  <StateGrid
    states={[
      [
        'Primary',
        <Button key="p" variant="primary">
          Start practising
        </Button>,
      ],
      ['Secondary', <Button key="s">Save clip</Button>],
      [
        'Quiet',
        <Button key="q" variant="quiet">
          Not now
        </Button>,
      ],
      [
        'Ghost',
        <Button key="g" variant="ghost">
          Cancel
        </Button>,
      ],
      [
        'Destructive',
        <Button key="d" variant="destructive">
          Delete song
        </Button>,
      ],
      [
        'Link',
        <Button key="l" variant="link">
          See Plus
        </Button>,
      ],
      [
        'Disabled',
        <Button key="x" disabled unavailableLabel="unavailable">
          Save clip
        </Button>,
      ],
      [
        'Loading',
        <Button key="w" loading>
          Saving
        </Button>,
      ],
      [
        'Invalid',
        <Button key="v" variant="quiet" aria-invalid>
          Choose a file
        </Button>,
      ],
      [
        'Small',
        <Button key="sm" size="sm" variant="ghost">
          Details
        </Button>,
      ],
      [
        'Large block',
        <Button key="lg" size="lg" block className="w-56">
          Add song
        </Button>,
      ],
    ]}
  />
)

/** Every variant and state in Night Rehearsal and Daylight (the G2 board and visual baseline). */
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
