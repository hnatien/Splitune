import type { Meta, StoryObj } from '@storybook/react-vite'
import { MetronomeIcon, PlayIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from 'lucide-react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button, SPINNER_DELAY_MS } from './button.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectFocusRing,
  expectInkEdge,
  expectTargets,
  expectUnavailable,
  isClear,
  resolve,
  StateGrid,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'

// Doc 26 §12.1, §12.3, s47 direction §4: every button is a pill. One filled ink control per view
// (`primary`); everything else is `outline` (the everyday button), `quiet` (recedes into the
// chrome), `selected` (an "on" state drawn as the 1.5 px ink edge), `destructive` or `link`.
// Every story shows at most one filled control.
const meta = {
  title: 'Base/Button',
  component: Button,
  args: { children: 'Start practising', onClick: fn() },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** The label's colour against the face it is printed on. */
const labelContrast = (button: HTMLElement) =>
  contrast(getComputedStyle(button).color, surfaceOf(button))

/** The one filled control: the ink, its label in the page colour at ≥ 4.5:1. */
export const Default: Story = {
  args: { variant: 'primary' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(contrast(surfaceOf(button), surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(labelContrast(button)).toBeGreaterThanOrEqual(4.5)
    }
  },
}

/** The everyday button: no fill, a --border-strong ring (it has a label, so the ring is extra). */
export const Outline: Story = {
  args: { variant: 'outline', children: 'Save clip' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(isClear(getComputedStyle(button).backgroundColor)).toBe(true)
      await expect(edgeOf(button)?.width).toBe(1)
      await expect(labelContrast(button)).toBeGreaterThanOrEqual(7)
    }
  },
}

/** Recedes into the chrome: muted text with no ring or fill at rest. */
export const Quiet: Story = {
  args: { variant: 'quiet', children: 'Not now' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(isClear(getComputedStyle(button).backgroundColor)).toBe(true)
      await expect(edgeOf(button)).toBeUndefined()
      await expect(labelContrast(button)).toBeGreaterThanOrEqual(4.5)
    }
  },
}

/** "On" is the 1.5 px ink edge at ≥ 3:1, never a grey fill: the face stays the page's. */
export const Selected: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="selected" aria-pressed>
        Count-in on
      </Button>
      <Button variant="outline" aria-pressed={false}>
        Metronome
      </Button>
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const on = within(frame).getByRole('button', { name: 'Count-in on' })
      const off = within(frame).getByRole('button', { name: 'Metronome' })
      await expectInkEdge(on)
      await expect(getComputedStyle(on).backgroundColor).toBe(getComputedStyle(off).backgroundColor)
      await expect(on).toHaveAttribute('aria-pressed', 'true')
    }
  },
}

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
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(labelContrast(button)).toBeGreaterThanOrEqual(4.5)
      await expect(edgeOf(button)?.color).toBe(getComputedStyle(button).color)
    }
  },
}

/** The confirm button inside a delete dialog only (26 §4.3): the page colour on the red. */
export const DestructiveSolid: Story = {
  args: { variant: 'destructiveSolid', children: 'Delete song' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      await expect(labelContrast(within(frame).getByRole('button'))).toBeGreaterThanOrEqual(4.5)
    }
  },
}

export const Link: Story = {
  args: { variant: 'link', children: 'See supported browsers' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(getComputedStyle(button).textDecorationLine).toBe('underline')
      await expect(labelContrast(button)).toBeGreaterThanOrEqual(7)
    }
  },
}

/** Every action shows its key: a key cap after the label, and aria-keyshortcuts for the name. */
export const WithShortcut: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button variant="primary" shortcut="Space">
        Play
      </Button>
      <Button shortcut="L">Loop</Button>
      <Button variant="quiet" shortcut="⌘K">
        Actions
      </Button>
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const loop = within(frame).getByRole('button', { name: 'Loop' })
      await expect(loop).toHaveAttribute('aria-keyshortcuts', 'L')
      const cap = loop.querySelector('kbd') as HTMLElement
      await expect(cap).toHaveTextContent('L')
      await expect(cap).toHaveAttribute('aria-hidden', 'true')
      // On the filled control the cap takes the page colour, so it stays legible on the ink.
      const play = within(frame).getByRole('button', { name: 'Play' })
      const playCap = play.querySelector('kbd') as HTMLElement
      await expect(
        contrast(getComputedStyle(playCap).color, surfaceOf(play)),
      ).toBeGreaterThanOrEqual(4.5)
    }
  },
}

/** Icon buttons: quiet, outline and selected (state in the name), each a full target. */
export const IconButtons: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={[
        [
          'Quiet',
          <Button key="i" variant="quiet" size="icon" aria-label="Close">
            <XIcon aria-hidden />
          </Button>,
        ],
        [
          'Outline',
          <Button key="b" variant="outline" size="icon" aria-label="Faster">
            <PlusIcon aria-hidden />
          </Button>,
        ],
        [
          'Selected',
          <Button key="o" variant="selected" size="icon" aria-label="Metronome, on" aria-pressed>
            <MetronomeIcon aria-hidden />
          </Button>,
        ],
        [
          'Practice 48',
          <Button key="p2" variant="outline" size="icon-practice" aria-label="Count-in">
            <MetronomeIcon aria-hidden />
          </Button>,
        ],
        [
          'Disabled',
          <Button key="d" variant="outline" size="icon" aria-label="Faster, unavailable" disabled>
            <PlusIcon aria-hidden />
          </Button>,
        ],
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      await expectTargets(canvas.getAllByRole('button'))
      await expectInkEdge(canvas.getByRole('button', { name: 'Metronome, on' }))
      for (const button of canvas.getAllByRole('button')) {
        await expect(button.getBoundingClientRect().width).toBe(
          button.getBoundingClientRect().height,
        )
      }
    }
  },
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

/** Focus: the 2 px ink outline 2 px off the painted face, ≥ 3:1 on the page, never clipped. */
export const Focus: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const button = within(canvasElement).getByRole('button')
    await expect(button).toHaveFocus()
    await expectFocusRing(button)
    // The transparent pad is 2 px, so the outline sits on the box edge, 2 px off the face.
    await expect(getComputedStyle(button).outlineOffset).toBe('0px')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

export const FocusIncreasedContrast: Story = {
  ...Focus,
  globals: { contrast: 'more' },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expectFocusRing(within(canvasElement).getByRole('button'), '3px')
  },
}

export const Pressed: Story = {
  args: { variant: 'outline', children: 'Save clip' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

/**
 * 26 §12.3: faint text, a ≥ 3:1 --edge ring, no fill (even on the primary), full opacity and
 * "Unavailable" in the name.
 */
export const Disabled: Story = {
  args: { variant: 'primary', disabled: true, unavailableLabel: 'unavailable' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const button = within(frame).getByRole('button')
      await expect(button).toBeDisabled()
      await expectUnavailable(button, 'unavailable')
      await expect(isClear(getComputedStyle(button).backgroundColor)).toBe(true)
      await expect(contrast(edgeOf(button)?.color ?? '', surfaceOf(frame))).toBeGreaterThanOrEqual(
        3,
      )
    }
  },
}

/**
 * Loading keeps the label and adds the spinner beside it after 300 ms; the button stays focusable
 * (so focus isn't lost) and announces busy, but does nothing.
 */
export const Loading: Story = {
  args: { variant: 'primary', loading: true, children: 'Email me a link' },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button')
    await expect(button).toHaveAttribute('aria-busy', 'true')
    // Busy is not unavailable: the primary keeps its ink fill and its label's colour.
    const style = getComputedStyle(button)
    await expect(style.backgroundColor).toBe(resolve(button, 'backgroundColor', '--primary'))
    await expect(style.color).toBe(resolve(button, 'backgroundColor', '--primary-foreground'))
    const label = within(canvasElement).getByText('Email me a link')
    await expect(label).toBeVisible()
    await expect(button.querySelector('[data-slot=spinner]')).toBeNull()
    await waitFor(() => expect(button.querySelector('[data-slot=spinner]')).not.toBeNull(), {
      timeout: SPINNER_DELAY_MS + 1000,
    })
    await expect(label).toBeVisible()
    await expect(button).toHaveAccessibleName(expect.stringContaining('Email me a link'))
    button.focus()
    await userEvent.keyboard('{Enter}')
    await expect(button).toHaveFocus()
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const Invalid: Story = {
  args: { variant: 'outline', 'aria-invalid': true, children: 'Choose a file' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const ring = edgeOf(within(frame).getByRole('button'))
      await expect(contrast(ring?.color ?? '', surfaceOf(frame))).toBeGreaterThanOrEqual(3)
    }
  },
}

/** A long label stays on one line and the pill grows; inside a narrow block it is cut, not wrapped. */
export const LongLabel: Story = {
  render: () => (
    <div className="flex w-72 flex-col items-start gap-3">
      <Button>Import a song from a link</Button>
      <Button block className="overflow-hidden">
        Try an example: Riff in A minor at 70 % with a count-in
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole('button')) {
      await expect(getComputedStyle(button).whiteSpace).toBe('nowrap')
      await expect(button.getBoundingClientRect().height).toBe(44)
    }
  },
}

const SIZES = (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary" size="icon-play" aria-label="Play">
      <PlayIcon aria-hidden />
    </Button>
    <Button size="play">Felt clean</Button>
    <Button size="practice">Count-in</Button>
    <Button size="xl">Resume</Button>
    <Button size="lg">Add song</Button>
    <Button size="md">Import a song</Button>
    <Button size="sm">Details</Button>
    <Button size="icon-practice" aria-label="Metronome">
      <MetronomeIcon aria-hidden />
    </Button>
    <Button size="icon" variant="quiet" aria-label="More">
      <SaveIcon aria-hidden />
    </Button>
    <Button size="icon-sm" variant="quiet" aria-label="Remove">
      <XIcon aria-hidden />
    </Button>
  </div>
)

/**
 * Doc 26 §8, V12: painted faces sm 36, md 40, lg 48, xl 56, practice 48, play 64; sm, md, lg and
 * the small icon sizes sit in a 44 box (48 in practice density) padded with a transparent border.
 */
export const Sizes: Story = {
  render: () => SIZES,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = (name: string) => canvas.getByRole('button', { name })
    const box = (name: string) => button(name).getBoundingClientRect()
    await expect([box('Play').width, box('Play').height]).toEqual([64, 64])
    await expect(box('Felt clean').height).toBe(64)
    await expect(box('Count-in').height).toBe(48)
    await expect(box('Resume').height).toBe(56)
    await expect(box('Add song').height).toBe(48)
    await expect(box('Import a song').height).toBe(44)
    await expect(box('Details').height).toBe(44)
    await expect([box('Metronome').width, box('Metronome').height]).toEqual([48, 48])
    await expect([box('More').width, box('More').height]).toEqual([44, 44])
    // The painted face (inside the transparent pad).
    await expect(button('Import a song').clientHeight).toBe(40)
    await expect(button('Details').clientHeight).toBe(36)
    await expect(button('More').clientHeight).toBe(40)
    await expect(button('Remove').clientHeight).toBe(36)
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
        <Button key="p" variant="primary" shortcut="Space">
          Start practising
        </Button>,
      ],
      ['Outline', <Button key="s">Save clip</Button>],
      [
        'Quiet',
        <Button key="q" variant="quiet">
          Not now
        </Button>,
      ],
      [
        'Selected',
        <Button key="sel" variant="selected" aria-pressed>
          Count-in on
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
        <Button key="v" variant="outline" aria-invalid>
          Choose a file
        </Button>,
      ],
      [
        'Small',
        <Button key="sm" size="sm" variant="quiet">
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

/** Every variant and state in Dark and Light (the G2 board and visual baseline). */
export const AllStates: Story = {
  render: Gallery,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      // One filled control per view.
      await expect(frame.querySelectorAll('[data-variant=primary]')).toHaveLength(1)
      for (const button of within(frame).getAllByRole('button')) {
        await expect(getComputedStyle(button).opacity).toBe('1')
        // A pill: the corner radius is at least half the button's height.
        await expect(
          Number.parseFloat(getComputedStyle(button).borderTopLeftRadius),
        ).toBeGreaterThanOrEqual(button.getBoundingClientRect().height / 2)
      }
    }
  },
}
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
