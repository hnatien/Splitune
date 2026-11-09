import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Badge } from './badge.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  expectTargets,
  themeFrames,
} from './story-kit.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx'

// Doc 26 §12.1 `.tabs`, §12.3: the selected tab's cue is its 2 px --signal underline.
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

const InspectorTabs = () => (
  <Tabs defaultValue="fix" className="w-95">
    <TabsList aria-label="Inspector">
      <TabsTrigger value="loop">Loop</TabsTrigger>
      <TabsTrigger value="mix">Mix</TabsTrigger>
      <TabsTrigger value="progress">Progress</TabsTrigger>
      <TabsTrigger value="fix">
        Fix
        <Badge variant="unsure">6</Badge>
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
      // The underline is the shape cue: 2 px, coloured only on the selected tab.
      await expect(file.borderBottomWidth).toBe('2px')
      await expect(file.borderBottomColor).not.toBe(link.borderBottomColor)
      await expect(file.color).not.toBe(link.color)
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
    await expect(getComputedStyle(file).outlineStyle).toBe('solid')
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

const Gallery = () => (
  <div className="flex flex-col gap-8">
    <SourceTabs />
    <InspectorTabs />
  </div>
)
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
