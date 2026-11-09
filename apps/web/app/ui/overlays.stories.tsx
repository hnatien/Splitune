import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronDownIcon, PlayIcon } from 'lucide-react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu.tsx'
import { Popover, PopoverTrigger } from './popover.tsx'
import {
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from './popover-content.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'
import { BOTH_THEMES, DAYLIGHT, expectTargets, StateGrid, themeFrames } from './story-kit.tsx'
import { WithTooltip } from './tooltip.tsx'

// Doc 26 §12.1 `.sheet`: --card, a --border edge, --elevation-2; popovers 16 px corners, menus and
// the select list 14. Popups portal to <body>, so each open state has a Daylight story of its own
// (the side-by-side frames theme only their subtree).
const meta = { title: 'Base/Overlays' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const DisplayPopover = () => (
  <Popover>
    <PopoverTrigger render={<Button variant="outline" />}>Display</PopoverTrigger>
    <PopoverContent>
      <PopoverHeader>
        <PopoverTitle>Display</PopoverTitle>
        <PopoverDescription>Reading size and score colours for this device.</PopoverDescription>
      </PopoverHeader>
    </PopoverContent>
  </Popover>
)

export const PopoverOpen: Story = {
  render: DisplayPopover,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Display' }))
    const text = await screen.findByText('Reading size and score colours for this device.')
    await waitFor(() => expect(text).toBeVisible())
  },
}

const PlayWithTooltip = () => (
  <WithTooltip label="Play" shortcut="Space">
    <Button variant="primary" size="icon-practice" aria-label="Play">
      <PlayIcon aria-hidden />
    </Button>
  </WithTooltip>
)

export const TooltipWithShortcut: Story = {
  render: PlayWithTooltip,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('button', { name: 'Play' })).toHaveFocus()
    // The popup's code loads on the first open.
    await waitFor(async () => expect(await screen.findByText('Space')).toBeVisible(), {
      timeout: 5000,
    })
  },
}

const SongMenu = () => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" />}>
      Song
      <ChevronDownIcon aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Song</DropdownMenuLabel>
        <DropdownMenuItem>
          Rename song
          <DropdownMenuShortcut>R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Show uncertainty</DropdownMenuCheckboxItem>
        <DropdownMenuItem disabled>Re-create stems</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">Delete song</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export const MenuOpen: Story = {
  render: SongMenu,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Song' }))
    const menu = await screen.findByRole('menu')
    await userEvent.keyboard('{ArrowDown}')
    await expect(within(menu).getAllByRole('menuitem').length).toBeGreaterThan(1)
  },
}

const InstrumentSelect = () => (
  <Select items={{ guitar: 'Guitar', bass: 'Bass', piano: 'Piano' }} defaultValue="guitar">
    <SelectTrigger aria-label="Instrument" className="w-48">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="guitar">Guitar</SelectItem>
      <SelectItem value="bass">Bass</SelectItem>
      <SelectItem value="piano">Piano</SelectItem>
    </SelectContent>
  </Select>
)

export const SelectClosed: Story = { render: InstrumentSelect }
export const SelectOpen: Story = {
  render: InstrumentSelect,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Instrument' }))
    const option = await screen.findByRole('option', { name: 'Bass' })
    await waitFor(() => expect(option).toBeVisible())
  },
}

export const PopoverOpenDaylight: Story = { ...PopoverOpen, globals: DAYLIGHT }
export const MenuOpenDaylight: Story = { ...MenuOpen, globals: DAYLIGHT }
export const SelectOpenDaylight: Story = { ...SelectOpen, globals: DAYLIGHT }
export const TooltipDaylight: Story = { ...TooltipWithShortcut, globals: DAYLIGHT }
export const SelectOpenStage: Story = { ...SelectOpen, globals: { appearance: 'stage' } }

/** Menu items and select options are 44 px rows (48 in practice density); the menu 14 px corners. */
export const MenuTargets: Story = {
  render: SongMenu,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Song' }))
    const menu = await screen.findByRole('menu')
    await waitFor(() => expect(menu).toBeVisible())
    await expect(getComputedStyle(menu).borderTopLeftRadius).toBe('14px')
    // Measured once the zoom-in has settled (the popup opens at 95 %).
    await waitFor(() =>
      expectTargets(
        [
          ...within(menu).getAllByRole('menuitem'),
          ...within(menu).getAllByRole('menuitemcheckbox'),
        ],
        { width: 44, height: 44 },
      ),
    )
  },
}

export const PopoverShape: Story = {
  render: DisplayPopover,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Display' }))
    const popup = await screen.findByRole('dialog')
    await expect(getComputedStyle(popup).borderTopLeftRadius).toBe('16px')
  },
}

function Triggers() {
  return (
    <StateGrid
      states={[
        ['Select', <InstrumentSelect key="s" />],
        [
          'Select disabled',
          <Select key="d" items={{ guitar: 'Guitar' }} defaultValue="guitar" disabled>
            <SelectTrigger aria-label="Instrument, unavailable" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="guitar">Guitar</SelectItem>
            </SelectContent>
          </Select>,
        ],
        [
          'Select invalid',
          <Select key="i" items={{ guitar: 'Guitar' }}>
            <SelectTrigger aria-label="Tuning" aria-invalid className="w-48">
              <SelectValue placeholder="Choose a tuning" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="guitar">Standard</SelectItem>
            </SelectContent>
          </Select>,
        ],
        ['Menu trigger', <SongMenu key="m" />],
        ['Popover trigger', <DisplayPopover key="p" />],
      ]}
    />
  )
}

/** Closed triggers in both themes: the select is a `.field` (44 tall, --input edge). */
export const AllStates: Story = {
  render: Triggers,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement))
      await expectTargets(within(frame).getAllByRole('combobox'), { width: 44, height: 44 })
  },
}
