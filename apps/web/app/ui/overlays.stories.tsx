import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronDownIcon, MoreHorizontalIcon, PlayIcon } from 'lucide-react'
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
import {
  BOTH_THEMES,
  contrast,
  DAYLIGHT,
  expectFloatingLayer,
  expectFocusRing,
  expectTargets,
  isClear,
  StateGrid,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'
import { WithTooltip } from './tooltip.tsx'

// Doc 26 §12.1, s47 direction §4: popovers, menus, the select list and tooltips are one kind of
// floating layer: the raised surface, one hairline, 14 px corners and the popover shadow. Nothing
// else casts a shadow. A chosen option carries a check, never a fill; every action shows its key.
// Popups portal to <body>, so each open state has a Light story of its own (the side-by-side
// frames theme only their subtree).
const meta = { title: 'Base/Overlays' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** Waits for a popup's enter animation, so measurements see the resting state. */
const settled = async (popup: HTMLElement) => {
  await waitFor(() => expect(popup).toBeVisible())
  await waitFor(() => expect(getComputedStyle(popup).opacity).toBe('1'))
  await waitFor(() =>
    expect(getComputedStyle(popup).transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/),
  )
  return popup
}

const DisplayPopover = () => (
  <Popover>
    <PopoverTrigger render={<Button variant="outline" />}>Display</PopoverTrigger>
    <PopoverContent>
      <PopoverHeader>
        <PopoverTitle>Display</PopoverTitle>
        <PopoverDescription>Reading size and score colours for this device.</PopoverDescription>
      </PopoverHeader>
      <Button variant="outline" size="sm" className="self-start">
        Reset to default
      </Button>
    </PopoverContent>
  </Popover>
)

const openPopover = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Display' }))
  return settled(await screen.findByRole('dialog', { name: 'Display' }))
}

export const PopoverOpen: Story = {
  render: DisplayPopover,
  play: async ({ canvasElement }) => {
    const popup = await openPopover(canvasElement)
    await expectFloatingLayer(popup, '--elevation-popover', '--radius-panel')
    await expect(
      within(popup).getByText('Reading size and score colours for this device.'),
    ).toBeVisible()
    // The trigger shows it is open; Escape closes it and focus goes back to the trigger.
    const trigger = within(canvasElement).getByRole('button', { name: 'Display' })
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}
export const PopoverOpenDaylight: Story = {
  render: DisplayPopover,
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    const popup = await openPopover(canvasElement)
    await expectFloatingLayer(popup, '--elevation-popover', '--radius-panel')
  },
}

const PlayWithTooltip = () => (
  <WithTooltip label="Play" shortcut="Space">
    <Button variant="primary" size="icon-play" aria-label="Play">
      <PlayIcon aria-hidden />
    </Button>
  </WithTooltip>
)

/** A tooltip names the action and prints its key; it supplements the button's own name. */
export const TooltipWithShortcut: Story = {
  render: PlayWithTooltip,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const play = within(canvasElement).getByRole('button', { name: 'Play' })
    await expect(play).toHaveFocus()
    // The popup's code loads on the first open.
    const key = await screen.findByText('Space', {}, { timeout: 5000 })
    const tooltip = key.closest('[data-slot=tooltip-content]') as HTMLElement
    await settled(tooltip)
    await expectFloatingLayer(tooltip, '--elevation-popover', '--radius-panel')
    await expect(key.tagName).toBe('KBD')
    await expect(play).toHaveAccessibleName('Play')
  },
}
export const TooltipDaylight: Story = { ...TooltipWithShortcut, globals: DAYLIGHT }

const SongMenu = () => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" />}>
      Song
      <ChevronDownIcon aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-60">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Song</DropdownMenuLabel>
        <DropdownMenuItem>
          Rename song
          <DropdownMenuShortcut>R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Show uncertainty</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Show bar numbers</DropdownMenuCheckboxItem>
        <DropdownMenuItem disabled>Re-create stems</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">Delete song</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

const openMenu = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Song' }))
  return settled(await screen.findByRole('menu'))
}

export const MenuOpen: Story = {
  render: SongMenu,
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expectFloatingLayer(menu, '--elevation-popover', '--radius-panel')
    // Checked is a check mark, not a fill: both checkbox items keep the menu's surface.
    const [on, off] = within(menu).getAllByRole('menuitemcheckbox') as [HTMLElement, HTMLElement]
    await expect(on).toHaveAttribute('aria-checked', 'true')
    await expect(on.querySelector('svg')).not.toBeNull()
    await expect(off.querySelector('svg')).toBeNull()
    await expect(getComputedStyle(on).backgroundColor).toBe(getComputedStyle(off).backgroundColor)
    // The shortcut is a key cap.
    await expect(within(menu).getByText('R').tagName).toBe('KBD')
    // A disabled item keeps full opacity; its text fades instead.
    const disabled = within(menu).getByRole('menuitem', { name: 'Re-create stems' })
    await expect(disabled).toHaveAttribute('aria-disabled', 'true')
    await expect(getComputedStyle(disabled).opacity).toBe('1')
  },
}
export const MenuOpenDaylight: Story = { ...MenuOpen, globals: DAYLIGHT }

/** Keyboard: arrows move the highlight; the highlighted item steps to --hover with the ink ring. */
export const MenuKeyboard: Story = {
  render: SongMenu,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Song' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const menu = await settled(await screen.findByRole('menu'))
    // Opening by keyboard highlights the first item; the arrow moves on to the next.
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: /Rename song/ })).toHaveFocus(),
    )
    await userEvent.keyboard('{ArrowDown}')
    const uncertainty = within(menu).getByRole('menuitemcheckbox', { name: 'Show uncertainty' })
    await waitFor(() => expect(uncertainty).toHaveFocus())
    await expect(getComputedStyle(uncertainty).backgroundColor).not.toBe(
      getComputedStyle(menu).backgroundColor,
    )
    await expectFocusRing(uncertainty)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

/** Menu items are 44 px rows (48 in practice density), inside 14 px corners. */
export const MenuTargets: Story = {
  render: SongMenu,
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expectTargets([
      ...within(menu).getAllByRole('menuitem'),
      ...within(menu).getAllByRole('menuitemcheckbox'),
    ])
  },
}
export const MenuTargetsPracticeDensity: Story = {
  render: SongMenu,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Song' }))
    // The popup portals out of the density wrapper, so it keeps browse rows: 44 is its floor.
    const menu = await settled(await screen.findByRole('menu'))
    await expectTargets(within(menu).getAllByRole('menuitem'))
    await expectTargets([within(canvasElement).getByRole('button', { name: 'Song' })], 48)
  },
}

/** A row's ⋯ menu: an icon trigger at full target size. */
export const RowMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="quiet" size="icon-sm" aria-label="More for Riff in A minor" />}
      >
        <MoreHorizontalIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem>Rename song</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete song</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'More for Riff in A minor' })
    await expectTargets([trigger])
    await userEvent.click(trigger)
    const menu = await settled(await screen.findByRole('menu'))
    const remove = within(menu).getByRole('menuitem', { name: 'Delete song' })
    // The destructive item's words are the red, at text contrast.
    await expect(
      contrast(getComputedStyle(remove).color, surfaceOf(remove)),
    ).toBeGreaterThanOrEqual(4.5)
  },
}

const InstrumentSelect = ({ wide = false }: { wide?: boolean }) => (
  <Select
    items={{
      guitar: 'Guitar',
      bass: 'Bass',
      piano: 'Piano',
      long: 'Twelve-string acoustic guitar in open D tuning',
    }}
    defaultValue="guitar"
  >
    <SelectTrigger aria-label="Instrument" className={wide ? 'w-full' : 'w-48'}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent aria-label="Instrument">
      <SelectItem value="guitar">Guitar</SelectItem>
      <SelectItem value="bass">Bass</SelectItem>
      <SelectItem value="piano">Piano</SelectItem>
      <SelectItem value="long">Twelve-string acoustic guitar in open D tuning</SelectItem>
    </SelectContent>
  </Select>
)

const openSelect = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Instrument' }))
  const list = await screen.findByRole('listbox')
  await waitFor(() => expect(list).toBeVisible())
  return list.closest('[data-slot=select-content]') as HTMLElement
}

export const SelectClosed: Story = { render: () => <InstrumentSelect /> }
export const SelectOpen: Story = {
  render: () => <InstrumentSelect />,
  play: async ({ canvasElement }) => {
    const popup = await openSelect(canvasElement)
    await expectFloatingLayer(popup, '--elevation-popover', '--radius-panel')
    // The chosen option has a check; the others don't, and none is filled.
    const guitar = await screen.findByRole('option', { name: 'Guitar' })
    const bass = screen.getByRole('option', { name: 'Bass' })
    await expect(guitar).toHaveAttribute('aria-selected', 'true')
    await expect(guitar.querySelector('svg')).not.toBeNull()
    await expect(bass.querySelector('svg')).toBeNull()
    await expectTargets(screen.getAllByRole('option'))
    await userEvent.click(bass)
    await waitFor(() =>
      expect(within(canvasElement).getByRole('combobox', { name: 'Instrument' })).toHaveTextContent(
        'Bass',
      ),
    )
  },
}
export const SelectOpenDaylight: Story = { ...SelectOpen, globals: DAYLIGHT }
export const SelectOpenStage: Story = { ...SelectOpen, globals: { appearance: 'stage' } }

/**
 * The trigger is a field: a 1 px --edge (≥ 3:1, its only boundary) that turns to the ink on hover,
 * on keyboard focus (under the 2 px outline) and while its list is open.
 */
export const SelectEdge: Story = {
  render: () => <InstrumentSelect />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const trigger = within(frame).getByRole('combobox', { name: 'Instrument' })
      const rest = getComputedStyle(trigger)
      await expect(rest.borderTopWidth).toBe('1px')
      await expect(contrast(rest.borderTopColor, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      trigger.focus()
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}')
      await expect(trigger).toHaveFocus()
      await expectFocusRing(trigger)
      await waitFor(() =>
        expect(getComputedStyle(trigger).borderTopColor).toBe(getComputedStyle(trigger).color),
      )
      trigger.blur()
    }
  },
}

/** On a coarse pointer the field text is 16 px (`text-field`), so iOS doesn't zoom into it. */
export const SelectCoarsePointer: Story = {
  render: () => <InstrumentSelect />,
  globals: { pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('combobox', { name: 'Instrument' })
    await expect(getComputedStyle(trigger).fontSize).toBe('16px')
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
          <Select key="i" items={{ guitar: 'Standard' }}>
            <SelectTrigger aria-label="Tuning" aria-invalid className="w-48">
              <SelectValue placeholder="Choose a tuning…" />
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

/**
 * Closed triggers in both themes: the select is a field (44 tall, 10 px corners). Disabled keeps its
 * ≥ 3:1 edge and no fill; invalid takes the red edge.
 */
export const AllStates: Story = {
  render: Triggers,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      await expectTargets(canvas.getAllByRole('combobox'))
      const enabled = canvas.getByRole('combobox', { name: 'Instrument' })
      const disabled = canvas.getByRole('combobox', { name: 'Instrument, unavailable' })
      const invalid = canvas.getByRole('combobox', { name: 'Tuning' })
      await expect(getComputedStyle(enabled).borderTopLeftRadius).toBe('10px')
      await expect(getComputedStyle(disabled).opacity).toBe('1')
      await expect(isClear(getComputedStyle(disabled).backgroundColor)).toBe(true)
      await expect(
        contrast(getComputedStyle(disabled).borderTopColor, surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
      await expect(getComputedStyle(invalid).borderTopColor).not.toBe(
        getComputedStyle(enabled).borderTopColor,
      )
    }
  },
}
