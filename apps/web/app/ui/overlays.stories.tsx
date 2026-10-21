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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './popover.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx'
import { WithTooltip } from './tooltip.tsx'

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
    await waitFor(async () => expect(await screen.findByText('Space')).toBeVisible())
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

export const MenuOpenDark: Story = { ...MenuOpen, globals: { appearance: 'dark' } }
export const SelectOpenStage: Story = { ...SelectOpen, globals: { appearance: 'stage' } }
export const PopoverOpenStage: Story = { ...PopoverOpen, globals: { appearance: 'stage' } }
export const TooltipDark: Story = { ...TooltipWithShortcut, globals: { appearance: 'dark' } }
