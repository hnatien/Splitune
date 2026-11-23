import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { expectTargets, isClear } from '@/ui/story-kit'
import { AppStory } from '../../../.storybook/app.tsx'
import { libraryQuery, workerStatusQuery } from '../library/queries'
import { useKeys } from '../practice/keys-store'
import { LIBRARY, ME, ME_PLUS, WORKER_OFFLINE, WORKER_ONLINE } from '../story-fixtures'
import { AppShell } from './app-shell'
import { FocusShell } from './focus-shell'
import { MarketingShell } from './marketing-shell'
import { type PaletteAction, parseLoopQuery, usePalette, usePaletteActions } from './palette-store'

// The shells (27 §1): the app shell's 232 px rail from 1024 px (Library and Settings with the
// current one marked by an ink line, Add song and Search with their keys, Recent, Usage, the
// processing machine and the account) and the 48 px top bar and bottom bar below it, the account
// menu, the "Drop to add" overlay, the ⌘K palette (open, results, a registered loop action, empty,
// offline), the marketing shell's phone Menu and the focus shell, in Dark and Light. Phone and
// tablet stories set the viewport global, so the same breakpoints apply as in the app.
const meta = {
  title: 'Screens/Shell',
  parameters: { layout: 'fullscreen' },
  // The palette's open state and the single-key switch are module state: every story starts with
  // the palette closed and single keys on.
  beforeEach: () => {
    usePalette.setState({ open: false })
    useKeys.setState({ singleKeys: true })
  },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const TABLET = { viewport: { value: 'tablet', isRotated: false } }
const DAYLIGHT = { appearance: 'light' }

const SONGS = LIBRARY.slice(0, 5)
const page = (items: typeof SONGS) => ({ items, next_cursor: null })

const seed = (client: QueryClient) => {
  client.setQueryData(meQuery.queryKey, ME)
  client.setQueryData(orpc.songs.list.queryKey({ input: { limit: 5 } }), page(SONGS))
  client.setQueryData(
    orpc.songs.list.queryKey({ input: { limit: 5, q: 'riff' } }),
    page(SONGS.filter((song) => /riff/i.test(song.title))),
  )
  client.setQueryData(orpc.songs.list.queryKey({ input: { limit: 5, q: 'zzz' } }), page([]))
  client.setQueryData(libraryQuery({}).queryKey, {
    pages: [page(SONGS)],
    pageParams: [undefined],
  })
  client.setQueryData(workerStatusQuery.queryKey, WORKER_ONLINE)
}

function LocationProbe() {
  const location = useRouterState({ select: (state) => state.location.href })
  return (
    <output data-testid="location" hidden>
      {location}
    </output>
  )
}

const appShell = (path: string) => () => (
  <AppStory path={path} seed={seed}>
    <AppShell me={ME}>
      <h1 className="text-heading">Library</h1>
      <p className="mt-2 text-muted-foreground">Page content</p>
      <LocationProbe />
    </AppShell>
  </AppStory>
)

const rail = async (canvasElement: HTMLElement) =>
  within(await within(canvasElement).findByRole('complementary', { name: 'App' }))

const playDesktop: Story['play'] = async ({ canvasElement }) => {
  const app = await rail(canvasElement)
  const aside = canvasElement.querySelector('[data-slot=panel]') as HTMLElement
  // A 232 px rail, docked (a hairline, no shadow), and no top bar from 1024 px (26 §7).
  await expect(aside.getBoundingClientRect().width).toBe(232)
  await expect(getComputedStyle(aside).boxShadow).toBe('none')
  await expect(within(canvasElement).queryByRole('banner')).toBeNull()
  const nav = within(app.getByRole('navigation', { name: 'Main' }))
  const library = nav.getByRole('link', { name: 'Library' })
  // The current page is a 2 px ink line on the item's leading side, not a fill.
  await expect(library).toHaveAttribute('aria-current', 'page')
  await expect(getComputedStyle(library, '::before').borderLeftWidth).toBe('2px')
  await expect(getComputedStyle(library).backgroundColor).toBe(
    getComputedStyle(nav.getByRole('link', { name: 'Settings' })).backgroundColor,
  )
  // Add song and Search carry their keys.
  await expect(nav.getByRole('button', { name: 'Add song' })).toHaveAttribute(
    'aria-keyshortcuts',
    'A',
  )
  await expect(
    nav.getByRole('button', { name: 'Search songs, clips and actions' }),
  ).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K')
  // Recent: the songs opened last, newest first, each to Practice.
  const recent = within(app.getByRole('region', { name: 'Recent' }))
  await expect(recent.getAllByRole('link')[0]).toHaveAttribute(
    'href',
    `/songs/${SONGS[0]?.id}/practice`,
  )
  await expect(app.getByText('Processing machine online')).toBeVisible()
  // The initials are painted from data-initials; the button's text is the name after "Account".
  const account = app.getByRole('button', { name: 'Account, Ana' })
  await expect(account.querySelector('[data-initials]')).toHaveAttribute('data-initials', 'A')
  await expectTargets(app.getAllByRole('button'))
  await expect(canvasElement.querySelector('[data-slot="bottom-tabs"]')).not.toBeVisible()
}

export const AppDesktop: Story = { render: appShell('/library'), play: playDesktop }
export const AppDesktopDaylight: Story = {
  render: appShell('/library'),
  play: playDesktop,
  globals: DAYLIGHT,
}

// In Settings the shell says so: Settings is the current rail item.
export const AppDesktopSettings: Story = {
  render: appShell('/settings/account'),
  play: async ({ canvasElement }) => {
    const nav = within((await rail(canvasElement)).getByRole('navigation', { name: 'Main' }))
    await expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current')
  },
}

// The machine that analyses songs is offline: the rail says so in the ink, with its own glyph.
export const AppDesktopWorkerOffline: Story = {
  render: () => (
    <AppStory
      path="/library"
      seed={(client) => {
        seed(client)
        client.setQueryData(workerStatusQuery.queryKey, WORKER_OFFLINE)
      }}
    >
      <AppShell me={ME}>
        <h1 className="text-heading">Library</h1>
      </AppShell>
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const app = await rail(canvasElement)
    await expect(await app.findByText('Processing machine offline')).toBeVisible()
  },
}

// `A` opens Add song from anywhere in the shell, unless single keys are off (WCAG 2.1.4) or the
// learner is typing.
export const AddSongKey: Story = {
  render: () => (
    <AppStory path="/library" seed={seed}>
      <AppShell me={ME}>
        <label className="flex flex-col gap-1">
          Notes
          <input className="border border-edge" />
        </label>
        <LocationProbe />
      </AppShell>
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const location = () => canvas.getByTestId('location').textContent ?? ''
    await rail(canvasElement)
    await userEvent.click(canvas.getByLabelText('Notes'))
    await userEvent.keyboard('a')
    await expect(location()).not.toContain('add=')
    useKeys.setState({ singleKeys: false })
    ;(document.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('a')
    await expect(location()).not.toContain('add=')
    useKeys.setState({ singleKeys: true })
    await userEvent.keyboard('a')
    // Add song opens on the tab used last.
    await waitFor(() => expect(location()).toMatch(/add=(file|link|record)/))
    const add = await within(document.body).findByRole(
      'dialog',
      { name: 'Add a song' },
      { timeout: 10_000 },
    )
    await waitFor(() => expect(add).toBeVisible())
  },
}

const appShellAs = (me: typeof ME) => () => (
  <AppStory
    path="/library"
    seed={(client) => {
      seed(client)
      client.setQueryData(meQuery.queryKey, me)
    }}
  >
    <AppShell me={me}>
      <h1 className="text-heading">Library</h1>
    </AppShell>
  </AppStory>
)

// The popover renders in a portal, outside the story's canvas.
const screen = () => within(document.body)

/** Opens Usage (the rail's row, or the top bar's gauge) and waits out the popover's entrance. */
async function openUsage(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await canvas.findAllByRole('button', { name: 'Usage' })
  const trigger = canvas.getAllByRole('button', { name: 'Usage' }).find((button) => {
    const box = button.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  }) as HTMLElement
  await userEvent.click(trigger)
  const dialog = await screen().findByRole('dialog', { name: 'Analysis limits' })
  await Promise.all(dialog.getAnimations({ subtree: true }).map((a) => a.finished))
  return { trigger, dialog, popover: within(dialog) }
}

// Usage: each allowance with its bar and reset date, then the plan with View plan, and See Plus
// on Free.
const playUsageFree: Story['play'] = async ({ canvasElement }) => {
  const { trigger, dialog, popover } = await openUsage(canvasElement)
  await expect(popover.getByText('Part of Plus')).toBeVisible()
  await expect(popover.getByRole('meter', { name: 'Lite analyses' })).toHaveAttribute(
    'aria-valuetext',
    '1 of 5 used, Resets 1 Dec',
  )
  await expect(popover.getByRole('meter', { name: 'Welcome analysis' })).toBeVisible()
  await expect(popover.getByText('Free', { exact: true })).toBeVisible()
  await expect(popover.getByRole('link', { name: 'View plan' })).toHaveAttribute(
    'href',
    '/settings/plan',
  )
  await expect(popover.getByRole('button', { name: 'See Plus' })).toBeVisible()
  // It opens beside the rail, from the row that opened it.
  await expect(dialog.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    trigger.getBoundingClientRect().right,
  )
}

export const UsagePopoverFree: Story = { render: appShell('/library'), play: playUsageFree }
export const UsagePopoverFreeDaylight: Story = {
  render: appShell('/library'),
  play: playUsageFree,
  globals: DAYLIGHT,
}
export const UsagePopoverPlus: Story = {
  render: appShellAs(ME_PLUS),
  play: async ({ canvasElement }) => {
    const { popover } = await openUsage(canvasElement)
    await expect(popover.getByText('3 of 15 used')).toBeVisible()
    await expect(popover.getByText('12 used · no monthly limit')).toBeVisible()
    await expect(popover.queryByRole('meter', { name: 'Welcome analysis' })).toBeNull()
    await expect(popover.getByText('Renews on 22 Nov')).toBeVisible()
    await expect(popover.queryByRole('button', { name: 'See Plus' })).toBeNull()
  },
}
const playUsagePhone: Story['play'] = async ({ canvasElement }) => {
  const { trigger, dialog } = await openUsage(canvasElement)
  // Under the top bar's gauge, inside the screen.
  const box = dialog.getBoundingClientRect()
  await expect(box.top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom)
  await expect(box.left).toBeGreaterThanOrEqual(0)
  await expect(box.right).toBeLessThanOrEqual(window.innerWidth)
}
export const UsagePopoverPhone: Story = {
  render: appShell('/library'),
  globals: PHONE,
  play: playUsagePhone,
}
export const UsagePopoverPhoneDaylight: Story = {
  render: appShell('/library'),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playUsagePhone,
}

// Below 1024 px: the 48 px top bar (the wordmark, search, Usage, account) and the bottom bar Library ·
// Add song · Settings, where Add song is a tab like the others (no filled pill competing with the
// page's own primary) and the current tab has an ink line.
const playPhone: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const nav = await canvas.findByRole('navigation', { name: 'Main' })
  await expect(nav).toHaveAttribute('data-slot', 'bottom-tabs')
  await expect(nav).toBeVisible()
  await expect(
    within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Library', 'Settings'])
  const add = within(nav).getByRole('button', { name: 'Add song' })
  await expect(isClear(getComputedStyle(add).backgroundColor)).toBe(true)
  const library = within(nav).getByRole('link', { name: 'Library' })
  await expect(library).toHaveAttribute('aria-current', 'page')
  await expect(getComputedStyle(library, '::before').borderTopWidth).toBe('2px')
  await expectTargets(within(nav).getAllByRole('link'))
  const banner = canvas.getByRole('banner')
  await expect(banner.getBoundingClientRect().height).toBe(48)
  await expect(
    within(banner).getByRole('link', { name: 'Splitune, go to your library' }),
  ).toHaveAttribute('href', '/library')
  await expect(
    within(banner).getByRole('button', { name: 'Search songs, clips and actions' }),
  ).toBeVisible()
  await expect(within(banner).getByRole('button', { name: 'Usage' })).toBeVisible()
  await expect(within(banner).getByRole('button', { name: 'Account' })).toBeVisible()
  await expect(canvas.queryByRole('complementary', { name: 'App' })).toBeNull()
}

export const AppPhone: Story = { render: appShell('/library'), play: playPhone, globals: PHONE }
export const AppPhoneDaylight: Story = {
  render: appShell('/library'),
  play: playPhone,
  globals: { ...PHONE, ...DAYLIGHT },
}
export const AppTablet: Story = { render: appShell('/library'), play: playPhone, globals: TABLET }
export const AppTabletDaylight: Story = {
  render: appShell('/library'),
  play: playPhone,
  globals: { ...TABLET, ...DAYLIGHT },
}

// The account menu (27 §1): the name and the username, Settings, Keyboard & pedal, the three
// appearances (D2), Help and Sign out.
const playAccountMenu: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole('button', { name: /^Account/ }))
  const menu = within(await within(document.body).findByRole('menu'))
  await waitFor(() => expect(menu.getByText('Help')).toBeVisible())
  // The name, never the placeholder email.
  await expect(menu.getByText('Ana', { exact: true })).toBeVisible()
  await expect(menu.queryByText(/splitune\.invalid/)).toBeNull()
  await expect(menu.getAllByRole('menuitemradio').map((item) => item.textContent?.trim())).toEqual([
    'Dark',
    'Light',
    'Follow my device',
  ])
  await expect(menu.getByRole('menuitem', { name: 'Keyboard & pedal' })).toHaveAttribute(
    'href',
    '/settings/keyboard',
  )
  await expect(menu.getByRole('menuitem', { name: 'How it works' })).toHaveAttribute(
    'href',
    '/how-it-works',
  )
  await expect(menu.getByRole('menuitem', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  await expect(menu.getByRole('menuitem', { name: 'Terms' })).toHaveAttribute(
    'href',
    '/legal/terms',
  )
  await expect(menu.getByRole('menuitem', { name: 'Privacy' })).toHaveAttribute(
    'href',
    '/legal/privacy',
  )
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
}
export const AccountMenuOpen: Story = { render: appShell('/library'), play: playAccountMenu }
export const AccountMenuOpenDaylight: Story = {
  render: appShell('/library'),
  play: playAccountMenu,
  globals: DAYLIGHT,
}
export const AccountMenuOpenPhone: Story = {
  render: appShell('/library'),
  play: playAccountMenu,
  globals: PHONE,
}

// A file dragged over the app turns the whole window into the drop target, with what it takes.
const playDrop: Story['play'] = async ({ canvasElement }) => {
  await within(canvasElement).findByText('Page content')
  const data = new DataTransfer()
  data.items.add(new File(['x'], 'riff.wav', { type: 'audio/wav' }))
  window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true }))
  const words = await within(document.body).findByText('Drop to add')
  // The layer pops in (26 §10); wait out its entrance.
  await waitFor(() => expect(words).toBeVisible())
  await expect(within(document.body).getByText(/MP3, M4A, WAV/)).toBeVisible()
  const target = words.closest('[role=status]') as HTMLElement
  await Promise.all(target.getAnimations().map((animation) => animation.finished))
  await expect(target.getBoundingClientRect().width).toBeGreaterThan(window.innerWidth - 40)
}
export const DropOverlay: Story = { render: appShell('/library'), play: playDrop }
export const DropOverlayDaylight: Story = {
  render: appShell('/library'),
  play: playDrop,
  globals: DAYLIGHT,
}
export const DropOverlayPhone: Story = {
  render: appShell('/library'),
  play: playDrop,
  globals: PHONE,
}

// The dialog is a lazy chunk: on a cold dev server Vite compiles it on first request, which can
// take longer than Testing Library's 1 s default when many stories run at once.
const LAZY = { timeout: 10_000 }

// The command palette (27 §3.12): Ctrl K opens it; songs, then actions, each action with its key;
// ↑/↓ move and the selected row carries the ink edge and its Enter key.
async function openPalette(canvasElement: HTMLElement) {
  await within(canvasElement).findByText('Page content')
  await userEvent.keyboard('{Control>}k{/Control}')
  const dialog = await within(document.body).findByRole('dialog', undefined, LAZY)
  // The dialog fades and zooms in (26 §10); wait until it has.
  await waitFor(() => expect(dialog).toBeVisible())
  return within(dialog)
}

const playPaletteOpen: Story['play'] = async ({ canvasElement }) => {
  const palette = await openPalette(canvasElement)
  const field = palette.getByRole('combobox', { name: 'Search songs, clips and actions' })
  await waitFor(() => expect(field).toHaveFocus())
  await expect(await palette.findByRole('group', { name: 'Songs' })).toBeVisible()
  await expect(palette.getByRole('group', { name: 'Actions' })).toBeVisible()
  const options = palette.getAllByRole('option')
  const [first, second] = options as [HTMLElement, HTMLElement]
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(within(first).getByText('Enter')).toBeVisible()
  // Selected is the ink edge, not a grey fill (26 §4.5).
  await expect(getComputedStyle(first).boxShadow).toContain('1.5px')
  await userEvent.keyboard('{ArrowDown}')
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await waitFor(() => expect(getComputedStyle(first).boxShadow).not.toContain('1.5px'))
  const add = palette.getByRole('option', { name: /Add song/ })
  await expect(within(add).getByText('A')).toBeVisible()
  await expect(palette.getByRole('option', { name: 'Appearance: Follow my device' })).toBeVisible()
}
export const PaletteOpen: Story = { render: appShell('/library'), play: playPaletteOpen }
export const PaletteOpenDaylight: Story = {
  render: appShell('/library'),
  play: playPaletteOpen,
  globals: DAYLIGHT,
}

export const PaletteResults: Story = {
  render: appShell('/library'),
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement)
    await userEvent.keyboard('riff')
    const song = await palette.findByRole('option', { name: /Riff in A minor/ })
    // The typed text is set in the label weight in the result.
    await waitFor(() => expect(song.querySelector('strong')?.textContent).toBe('Riff'))
    await waitFor(() => expect(palette.queryByRole('option', { name: /Walking bass/ })).toBeNull())
  },
}

// Practice registers "Loop bars a–b" (s35); "loop 17-20" turns into that row.
const LOOP_ACTIONS: PaletteAction[] = [
  {
    id: 'loop',
    label: 'Loop bars',
    run: () => undefined,
    parse: (query) => {
      const bars = parseLoopQuery(query)
      return bars && { label: `Loop bars ${bars.start}–${bars.end}`, run: () => undefined }
    },
  },
]
function LoopRegistration() {
  usePaletteActions('actions', LOOP_ACTIONS)
  return null
}
export const PaletteLoop: Story = {
  render: () => (
    <AppStory path="/library" seed={seed}>
      <AppShell me={ME}>
        <p>Page content</p>
        <LoopRegistration />
      </AppShell>
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement)
    await userEvent.keyboard('loop 17-20')
    await expect(await palette.findByRole('option', { name: /Loop bars 17–20/ })).toBeVisible()
  },
}

const playPaletteEmpty: Story['play'] = async ({ canvasElement }) => {
  const palette = await openPalette(canvasElement)
  await userEvent.keyboard('zzz')
  await expect(
    await palette.findByText('No matches. Try a song title or “loop 17-20”.'),
  ).toBeVisible()
}
export const PaletteEmpty: Story = { render: appShell('/library'), play: playPaletteEmpty }
export const PaletteEmptyDaylight: Story = {
  render: appShell('/library'),
  play: playPaletteEmpty,
  globals: DAYLIGHT,
}
export const PalettePhone: Story = {
  render: appShell('/library'),
  play: playPaletteOpen,
  globals: PHONE,
}

// Offline (27 §4): songs come from the cache only.
export const PaletteOffline: Story = {
  render: appShell('/library'),
  beforeEach: () => {
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
    return () => {
      if (online) Object.defineProperty(Navigator.prototype, 'onLine', online)
    }
  },
  play: async ({ canvasElement }) => {
    const palette = await openPalette(canvasElement)
    await expect(await palette.findByText(/Offline: songs saved on this device/)).toBeVisible()
    await userEvent.keyboard('campfire')
    await expect(await palette.findByRole('option', { name: /Campfire strumming/ })).toBeVisible()
  },
}

const marketing = (signedIn: boolean) => () => (
  <AppStory path="/">
    <MarketingShell signedIn={signedIn}>
      <p className="mx-auto max-w-page px-4 py-8">Page content</p>
    </MarketingShell>
  </AppStory>
)

export const MarketingDesktop: Story = {
  render: marketing(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Try an example song' })).toHaveAttribute(
      'href',
      '/start',
    )
    const header = within(canvas.getByRole('banner'))
    await expect(header.getByRole('link', { name: 'How it works' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Pricing' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Menu' })).toBeNull()
  },
}
export const MarketingDesktopSignedIn: Story = { render: marketing(true) }

// Below sm everything but the wordmark collapses into the Menu button, so the pinned bar is one row.
const playMarketingMenu: Story['play'] = async ({ canvasElement }) => {
  const banner = await within(canvasElement).findByRole('banner')
  await expect(banner.getBoundingClientRect().height).toBeLessThan(80)
  await expect(getComputedStyle(banner).position).toBe('sticky')
  await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Menu' }))
  const menu = within(await within(document.body).findByRole('menu'))
  await expect(menu.getByRole('menuitem', { name: 'How it works' })).toHaveAttribute(
    'href',
    '/how-it-works',
  )
  await expect(menu.getByRole('menuitem', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  await expect(menu.getByRole('menuitem', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/auth/sign-in',
  )
  await expect(menu.getByRole('menuitem', { name: 'Try an example song' })).toHaveAttribute(
    'href',
    '/start',
  )
}
export const MarketingPhoneMenuOpen: Story = {
  render: marketing(false),
  play: playMarketingMenu,
  globals: PHONE,
}
export const MarketingPhoneMenuOpenDaylight: Story = {
  render: marketing(false),
  play: playMarketingMenu,
  globals: { ...PHONE, ...DAYLIGHT },
}

const focus = (exit: boolean) => () => (
  <AppStory path="/songs/s1/practice" seed={seed}>
    <FocusShell exit={exit} status={<span className="truncate">Wonderwall</span>}>
      <p className="px-4 py-6">Page content</p>
    </FocusShell>
  </AppStory>
)

const playFocus: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByRole('link', { name: 'Back to library' })).toHaveAttribute(
    'href',
    '/library',
  )
  await expect(canvas.queryByRole('navigation', { name: 'Main' })).toBeNull()
}
export const FocusDesktop: Story = { render: focus(false), play: playFocus }
export const FocusDesktopDaylight: Story = {
  render: focus(false),
  play: playFocus,
  globals: DAYLIGHT,
}
export const FocusPhone: Story = { render: focus(false), play: playFocus, globals: PHONE }

// Signed in, ⌘K works in the focus shell too, and touch screens get its button (27 §3.12).
export const FocusPalette: Story = {
  render: focus(false),
  globals: { pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Search songs, clips and actions' }),
    )
    const dialog = await within(document.body).findByRole('dialog', undefined, LAZY)
    await waitFor(() => expect(dialog).toBeVisible())
  },
}
export const FocusExit: Story = {
  render: focus(true),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('link', { name: 'Exit' })).toHaveAttribute(
      'href',
      '/',
    )
  },
}
