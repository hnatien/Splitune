import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { libraryQuery } from '../library/queries'
import { LIBRARY, ME } from '../story-fixtures'
import { AppShell } from './app-shell'
import { FocusShell } from './focus-shell'
import { MarketingShell } from './marketing-shell'
import { type PaletteAction, parseLoopQuery, usePalette, usePaletteActions } from './palette-store'

// The shells (27 §1): the app shell's 64 px bar (Library, Settings, search, allowance, Add song,
// account) and the phone header and bottom bar, the account menu, the "Drop to add" overlay, the
// ⌘K palette (open, results, a registered loop action, empty, offline), the marketing shell's
// phone Menu and the focus shell, in Night Rehearsal and Daylight. Phone stories set the viewport
// global, so the same breakpoints apply as in the app.
const meta = {
  title: 'Screens/Shell',
  parameters: { layout: 'fullscreen' },
  // The palette's open state is module state: every story starts with it closed.
  beforeEach: () => usePalette.setState({ open: false }),
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
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
}

const appShell = (path: string) => () => (
  <AppStory path={path} seed={seed}>
    <AppShell me={ME}>
      <h1 className="text-3xl">Library</h1>
      <p className="mt-2 text-muted-foreground">Page content</p>
    </AppShell>
  </AppStory>
)

const playDesktop: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const banner = await canvas.findByRole('banner')
  // 64 px plus the 1 px rule under it, sticky (26 §7).
  await expect(banner.getBoundingClientRect().height).toBe(65)
  await expect(getComputedStyle(banner).position).toBe('sticky')
  const nav = await canvas.findByRole('navigation', { name: 'Main' })
  const links = within(nav).getAllByRole('link')
  await expect(links.map((link) => link.textContent)).toEqual(['Library', 'Settings'])
  await expect(within(nav).getByRole('link', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const header = within(banner)
  await expect(
    header.getByRole('button', { name: /Search songs, clips and actions/ }),
  ).toBeVisible()
  await expect(header.getByText('4 of 5 Lite left · resets 1 Dec')).toBeVisible()
  await expect(header.getByRole('button', { name: 'Add song' })).toBeVisible()
  // The initials are painted from data-initials, so the button's only text is "Account" (2.5.3).
  const account = header.getByRole('button', { name: 'Account' })
  await expect(account.querySelector('[data-initials]')).toHaveAttribute('data-initials', 'A')
  await expect(account).toHaveTextContent(/^$/)
  await expect(canvasElement.querySelector('[data-slot="bottom-tabs"]')).not.toBeVisible()
}

export const AppDesktop: Story = { render: appShell('/library'), play: playDesktop }
export const AppDesktopDaylight: Story = {
  render: appShell('/library'),
  play: playDesktop,
  globals: DAYLIGHT,
}

// Any settings section keeps Settings current, though the link leads to Account.
export const AppDesktopSettingsCurrent: Story = {
  render: appShell('/settings/about'),
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole('navigation', { name: 'Main' })
    await expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(within(nav).getByRole('link', { name: 'Library' })).not.toHaveAttribute(
      'aria-current',
    )
  },
}

const playPhone: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const nav = await canvas.findByRole('navigation', { name: 'Main' })
  await expect(nav).toHaveAttribute('data-slot', 'bottom-tabs')
  await expect(nav).toBeVisible()
  // Phone-Library: Library · Add song (a 48 px pill) · Settings in a 76 px bar.
  await expect(nav.getBoundingClientRect().height).toBe(76)
  await expect(
    within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Library', 'Settings'])
  await expect(within(nav).getByRole('button', { name: 'Add song' })).toBeVisible()
  await expect(within(nav).getByRole('link', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  // The 56 px header: the page title, search and the account menu.
  const banner = canvas.getByRole('banner')
  await expect(banner.getBoundingClientRect().height).toBe(56)
  await expect(within(banner).getByText('Library', { selector: 'p' })).toBeVisible()
  await expect(
    within(banner).getByRole('button', { name: 'Search songs, clips and actions' }),
  ).toBeVisible()
  await expect(within(banner).getByRole('button', { name: 'Account' })).toBeVisible()
}

export const AppPhone: Story = { render: appShell('/library'), play: playPhone, globals: PHONE }
export const AppPhoneDaylight: Story = {
  render: appShell('/library'),
  play: playPhone,
  globals: { ...PHONE, ...DAYLIGHT },
}

// The account menu (27 §1): the username, Settings, Keyboard & pedal, the three appearances (D2),
// Help and Sign out.
const playAccountMenu: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Account' }))
  const menu = within(await within(document.body).findByRole('menu'))
  await waitFor(() => expect(menu.getByText('Help')).toBeVisible())
  // The username, never the placeholder email.
  await expect(menu.getByText('Ana', { exact: true })).toBeVisible()
  await expect(menu.queryByText(/splitune\.invalid/)).toBeNull()
  await expect(menu.getAllByRole('menuitemradio').map((item) => item.textContent?.trim())).toEqual([
    'Night Rehearsal',
    'Daylight',
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

// A file dragged over the app shows "Drop to add" (27 §1).
const playDrop: Story['play'] = async ({ canvasElement }) => {
  await within(canvasElement).findByRole('banner')
  const data = new DataTransfer()
  data.items.add(new File(['x'], 'riff.wav', { type: 'audio/wav' }))
  window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true }))
  await expect(await within(document.body).findByText('Drop to add')).toBeVisible()
}
export const DropOverlay: Story = { render: appShell('/library'), play: playDrop }
export const DropOverlayDaylight: Story = {
  render: appShell('/library'),
  play: playDrop,
  globals: DAYLIGHT,
}

// The dialog is a lazy chunk: on a cold dev server Vite compiles it on first request, which can
// take longer than Testing Library's 1 s default when many stories run at once.
const LAZY = { timeout: 10_000 }

// The command palette (27 §3.12): Ctrl K opens it; songs, then actions; ↑/↓ move and the selected
// row shows Enter.
async function openPalette(canvasElement: HTMLElement) {
  await within(canvasElement).findByRole('banner')
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
  await expect(options[0]).toHaveAttribute('aria-selected', 'true')
  await expect(within(options[0] as HTMLElement).getByText('Enter')).toBeVisible()
  await userEvent.keyboard('{ArrowDown}')
  await expect(options[1]).toHaveAttribute('aria-selected', 'true')
  await expect(palette.getByRole('option', { name: /Add song/ })).toBeVisible()
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
    // The typed text is bold in the result.
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
