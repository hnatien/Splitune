import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectFocusRing,
  expectInkEdge,
  expectTargets,
  isClear,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx'

// Doc 26 §12.1 `.tabs`, s47 direction §4: one rule, two looks. The selected tab is marked by the
// ink: a 2 px ink underline in the `line` look (sections of a page or the panel), the 1.5 px ink
// edge in the compact `pill` look (views of one thing). Never a grey capsule or track.
const meta = { title: 'Base/Tabs', component: Tabs } satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>

const SourceTabs = ({ value = 'file' }: { value?: string }) => (
  <Tabs defaultValue={value} className="max-w-xl">
    <TabsList aria-label="Add a song">
      <TabsTrigger value="file">File</TabsTrigger>
      <TabsTrigger value="link">Link</TabsTrigger>
      <TabsTrigger value="record">Record</TabsTrigger>
      <TabsTrigger value="example" disabled aria-label="Example, unavailable">
        Example
      </TabsTrigger>
    </TabsList>
    <TabsContent value="file">Choose an audio or video file from this device.</TabsContent>
    <TabsContent value="link">Paste a link to a song.</TabsContent>
    <TabsContent value="record">Record yourself playing.</TabsContent>
  </Tabs>
)

// The pill look (Add song's source switch, Tab · Chords): compact rounded tabs side by side that
// never span the width, the selected one with the ink edge.
const PillTabs = ({ value = 'file' }: { value?: string }) => (
  <Tabs defaultValue={value} className="max-w-md">
    <TabsList look="pill" aria-label="Add a song">
      <TabsTrigger value="file">File</TabsTrigger>
      <TabsTrigger value="link">Link</TabsTrigger>
      <TabsTrigger value="record">Record</TabsTrigger>
    </TabsList>
    <TabsContent value="file">Choose an audio or video file from this device.</TabsContent>
    <TabsContent value="link">Paste a link to a song.</TabsContent>
    <TabsContent value="record">Record yourself playing.</TabsContent>
  </Tabs>
)

const InspectorTabs = () => (
  <Tabs defaultValue="fix" className="w-95">
    <TabsList aria-label="Inspector">
      <TabsTrigger value="loop">Loop</TabsTrigger>
      <TabsTrigger value="mix">Mix</TabsTrigger>
      <TabsTrigger value="progress">Progress</TabsTrigger>
      <TabsTrigger value="fix">
        Fix
        <span aria-hidden className="text-caption text-muted-foreground tabular-nums">
          6
        </span>
        <span className="sr-only">, 6 unsure spots</span>
      </TabsTrigger>
    </TabsList>
    <TabsContent value="fix">Spot 2 of 6 · bar 27–28</TabsContent>
  </Tabs>
)

export const Default: Story = {
  render: () => <SourceTabs />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const file = getComputedStyle(canvas.getByRole('tab', { name: 'File' }))
      const link = getComputedStyle(canvas.getByRole('tab', { name: 'Link' }))
      // The underline is the shape cue: 2 px, the ink only on the selected tab, ≥ 3:1.
      await expect(file.borderBottomWidth).toBe('2px')
      await expect(contrast(file.borderBottomColor, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(isClear(link.borderBottomColor)).toBe(true)
      await expect(file.backgroundColor).toBe(link.backgroundColor)
      await expect(file.color).not.toBe(link.color)
      // An unselected tab is muted text, still ≥ 4.5:1.
      await expect(contrast(link.color, surfaceOf(frame))).toBeGreaterThanOrEqual(4.5)
    }
  },
}

export const Selected: Story = { render: () => <SourceTabs value="record" />, globals: BOTH_THEMES }

export const Hover: Story = {
  render: () => <SourceTabs />,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('tab', { name: 'Link' })
    await userEvent.hover(link)
    await expect(link).toBeVisible()
  },
}
export const HoverDaylight: Story = { ...Hover, globals: DAYLIGHT }

export const Focus: Story = {
  render: () => <SourceTabs />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const file = within(canvasElement).getByRole('tab', { name: 'File' })
    await expect(file).toHaveFocus()
    // The outline is drawn inside the tab, so the list's hairline and its neighbours never clip it.
    await expectFocusRing(file)
    await expect(getComputedStyle(file).outlineOffset).toBe('-2px')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

export const Keyboard: Story = {
  render: () => <SourceTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('tab', { name: 'File' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('tab', { name: 'Link' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByText('Paste a link to a song.')).toBeVisible()
  },
}

export const Disabled: Story = {
  render: () => <SourceTabs />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const tab = within(frame).getByRole('tab', { name: 'Example, unavailable' })
      await expect(tab).toHaveAttribute('data-disabled')
      await expect(getComputedStyle(tab).opacity).toBe('1')
      // Faint text, not a fade: still ≥ 4.5:1 on the page.
      await expect(contrast(getComputedStyle(tab).color, surfaceOf(frame))).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  },
}

/** Tabs are 44 tall in browse screens and 48 in the practice inspector (26 §8). */
export const Targets: Story = {
  render: () => <SourceTabs />,
  play: async ({ canvasElement }) => {
    await expectTargets(within(canvasElement).getAllByRole('tab'), { width: 44, height: 44 })
  },
}
export const PracticeInspector: Story = {
  render: () => <InspectorTabs />,
  globals: { appearance: 'side-by-side', density: 'practice' },
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement))
      await expectTargets(within(frame).getAllByRole('tab'), 48)
  },
}

export const Pill: Story = {
  render: () => <PillTabs />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const tabs = canvas.getAllByRole('tab')
      await expectTargets(tabs)
      // Compact: the list is as wide as its tabs, never the width of its container.
      const list = canvas.getByRole('tablist')
      await expect(list.getBoundingClientRect().width).toBeLessThan(
        (list.parentElement as HTMLElement).getBoundingClientRect().width,
      )
      // No track and no capsule: the selected tab is the ink edge on the page's own surface.
      await expect(isClear(getComputedStyle(list).backgroundColor)).toBe(true)
      const file = canvas.getByRole('tab', { name: 'File' })
      const record = canvas.getByRole('tab', { name: 'Record' })
      await expectInkEdge(file)
      await expect(edgeOf(record)).toBeUndefined()
      await expect(getComputedStyle(file).backgroundColor).toBe(
        getComputedStyle(record).backgroundColor,
      )
      await userEvent.click(record)
      await expect(record).toHaveAttribute('aria-selected', 'true')
      await waitFor(() => expect(edgeOf(record)?.width).toBe(1.5))
      await expect(canvas.getByText('Record yourself playing.')).toBeVisible()
    }
  },
}
export const PillSelected: Story = {
  render: () => <PillTabs value="link" />,
  globals: BOTH_THEMES_MORE_CONTRAST,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement))
      await expectInkEdge(within(frame).getByRole('tab', { name: 'Link' }))
  },
}
export const PillFocus: Story = {
  render: () => <PillTabs />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const file = within(canvasElement).getByRole('tab', { name: 'File' })
    await expect(file).toHaveFocus()
    await expectFocusRing(file)
  },
}

/** A long label keeps one line; the list wraps nothing and the selected cue stays the ink. */
export const LongLabels: Story = {
  render: () => (
    <Tabs defaultValue="progress" className="w-85">
      <TabsList aria-label="Tools">
        <TabsTrigger value="loop">Loop</TabsTrigger>
        <TabsTrigger value="progress">Progress this week</TabsTrigger>
        <TabsTrigger value="fix">Fix</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      for (const tab of within(frame).getAllByRole('tab'))
        await expect(getComputedStyle(tab).whiteSpace).toBe('nowrap')
    }
  },
}

const Gallery = () => (
  <div className="flex flex-col gap-8">
    <SourceTabs />
    <PillTabs />
    <InspectorTabs />
  </div>
)
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
