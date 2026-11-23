import type { DataExportState, WorkerStatus } from '@splitune/contracts'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { z } from 'zod'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { meQuery } from '@/lib/session'
import { DEFAULT_DISPLAY } from '@/ui/display'
import { AppStory } from '../../../.storybook/app.tsx'
import { plansQuery } from '../billing/plans'
import { workerStatusQuery } from '../library/queries'
import { AppShell } from '../shell/app-shell'
import { ME, PLANS } from '../story-fixtures'
import { AboutSettings } from './about-settings'
import { AccountSettings } from './account-settings'
import { DisplaySettings } from './display-settings'
import { KeyboardSettings } from './keyboard-settings'
import { type DeleteStep, exportStateQuery } from './privacy-settings'
import { SettingsLayout } from './settings-layout'

// Settings (s47 direction §6, 27 §3.9): Account (Profile, Privacy, Sign out), Display & practice,
// Keyboard & pedal and About (Usage and Plan are in plan.stories.tsx), as plain rows at the
// settings width, in Dark (the default), Light and on a phone. The Privacy stories render Account
// (Privacy is one of its sections) and keep their ids for the visual matrix.
const meta = { title: 'Screens/Settings', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const DAYLIGHT = { appearance: 'light' }
const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const TABLET = { viewport: { value: 'tablet', isRotated: false } }

const shell = (
  section: string,
  children: React.ReactNode,
  seed?: (client: QueryClient) => void,
) => (
  <AppStory path={`/settings/${section}`} {...(seed ? { seed } : {})}>
    <AppShell me={ME}>
      <SettingsLayout>{children}</SettingsLayout>
    </AppShell>
  </AppStory>
)

async function noSidewaysScroll({ canvasElement }: { canvasElement: HTMLElement }) {
  const root = canvasElement.ownerDocument.documentElement
  await waitFor(() => expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth))
}

/** The section list never pushes the page's h1 down: one line of tabs on phones. */
async function headingNearTop({ canvasElement }: { canvasElement: HTMLElement }) {
  const heading = await within(canvasElement).findByRole('heading', { level: 1 })
  await expect(heading.getBoundingClientRect().top + window.scrollY).toBeLessThan(200)
}

/** Display & practice (27 §3.9, Settings-Display): appearance cards, reading, motion, defaults. */
export const Display: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cards = await canvas.findByRole('radiogroup', { name: 'Appearance' })
    await expect(within(cards).getAllByRole('radio')).toHaveLength(3)
    const dark = within(cards).getByRole('radio', { name: /^Dark/ })
    await expect(dark).toBeChecked()
    // Choices are rows: the chosen one has the ink edge (26 §12.1), never a tinted card.
    await expect(getComputedStyle(dark).boxShadow).toContain('1.5px')
    // Where these are stored is said once, as words, not a green pill.
    await expect(canvas.getByText(/^Saved on this device/)).toBeVisible()
    await expect(canvasElement.querySelector('[data-slot=badge]')).toBeNull()
    await expect(
      canvas.getByText('Can you read the fret numbers from where you play?'),
    ).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Hyperlegible font' })).not.toBeChecked()
    await expect(canvas.getByRole('switch', { name: 'Left-handed' })).not.toBeChecked()
    await expect(canvas.queryByText('Score')).toBeNull()
    // The speed ladder's stepper has its unit.
    await expect(canvas.getAllByText('clean passes')[0]).toBeVisible()
  },
}
export const DisplayDaylight: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  globals: DAYLIGHT,
}
/** Practice defaults → Speed ladder (27 §3.9, D3): '+5 % after 3 clean passes', a stepper for the
 * passes, and 'On for new loops' (off until the learner turns it on). */
export const DisplayLadderDefault: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  beforeEach: () => () =>
    usePracticeDefaults.getState().update({ ladderCleanPasses: 3, ladderNewLoops: false }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/^\+5\s% after 3 clean passes$/)).toBeVisible()
    await expect(canvas.getByText(/^Up to 100\s%$/)).toBeVisible()
    const newLoops = canvas.getByRole('switch', { name: 'On for new loops' })
    await expect(newLoops).not.toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: 'Fewer clean passes' }))
    await expect(await canvas.findByText(/^\+5\s% after 2 clean passes$/)).toBeVisible()
    await userEvent.click(newLoops)
    await waitFor(() => expect(usePracticeDefaults.getState().ladderNewLoops).toBe(true))
    await expect(usePracticeDefaults.getState().ladderCleanPasses).toBe(2)
  },
}
export const DisplayPhone: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  globals: PHONE,
  play: async (context) => {
    await noSidewaysScroll(context)
    await headingNearTop(context)
  },
}
export const DisplayPhoneDaylight: Story = { ...DisplayPhone, globals: { ...PHONE, ...DAYLIGHT } }
/** A stored `stage` (26 §2, D2) has no card: it shows Dark and the distance it raised. */
export const DisplayStage: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  globals: { appearance: 'stage', distance: 'stand' },
  beforeEach: () => {
    useDisplay.setState({ appearance: 'stage', distance: undefined })
    return () => useDisplay.setState(DEFAULT_DISPLAY)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cards = await canvas.findByRole('radiogroup', { name: 'Appearance' })
    await expect(within(cards).getByRole('radio', { name: /^Dark/ })).toBeChecked()
    const distance = canvas.getByRole('group', { name: 'Where is your screen?' })
    await expect(within(distance).getByRole('button', { name: 'Music stand' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

type ExportState = z.infer<typeof DataExportState>

const NO_EXPORT: ExportState = {
  status: 'none',
  requested_at: null,
  ready_at: null,
  expires_at: null,
  url: null,
}
const IN_A_DAY = new Date(Date.now() + 86_400_000).toISOString()

const privacy =
  (
    state: ExportState | null,
    options: { worker?: boolean; dialog?: DeleteStep; me?: typeof ME } = {},
  ) =>
  () => {
    const me = options.me ?? ME
    return shell('account', <AccountSettings me={me} deleteDialog={options.dialog} />, (client) => {
      client.setQueryData(meQuery.queryKey, me)
      client.setQueryData(plansQuery.queryKey, PLANS)
      if (state) client.setQueryData(exportStateQuery(false).queryKey, state)
      const runner = { online: options.worker ?? true, last_heartbeat_at: null }
      const worker: z.infer<typeof WorkerStatus> = {
        online: runner.online,
        runners: { python: runner, node: runner },
      }
      client.setQueryData(workerStatusQuery.queryKey, worker)
    })
  }

/** Account (27 §3.9, Settings-Account): Profile, Privacy and Sign out; Plan is its own section. */
export const Account: Story = {
  render: privacy(NO_EXPORT),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
    await expect(canvas.getByLabelText('Name')).toHaveValue('Ana')
    await expect(canvas.getByText("You sign in with this. It can't be changed here.")).toBeVisible()
    // The username can't be changed here, so it reads as text, not as a field.
    await expect(canvas.queryByRole('textbox', { name: 'Username' })).toBeNull()
    const username = canvasElement.querySelector('[data-slot=username]') as HTMLElement
    await expect(username).toHaveTextContent('Ana')
    await expect(getComputedStyle(username).borderTopWidth).toBe('0px')
    await expect(canvas.getByRole('combobox', { name: 'Main instrument' })).toHaveTextContent(
      'Guitar',
    )
    await expect(canvas.getByRole('group', { name: 'How long have you played?' })).toBeVisible()
    await expect(canvas.queryByText(/Demo/)).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeVisible()
    // The current section is the ink line, the same mark as the rail's current page.
    const sections = within(canvas.getByRole('navigation', { name: 'Settings sections' }))
    const current = sections.getByRole('link', { name: 'Account' })
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(getComputedStyle(current, '::before').borderLeftWidth).toBe('2px')
  },
}
export const AccountDaylight: Story = { render: privacy(NO_EXPORT), globals: DAYLIGHT }
const playAccountNarrow: Story['play'] = async (context) => {
  await noSidewaysScroll(context)
  await headingNearTop(context)
  const sections = within(
    within(context.canvasElement).getByRole('navigation', { name: 'Settings sections' }),
  )
  const current = sections.getByRole('link', { name: 'Account' })
  await expect(getComputedStyle(current).borderBottomWidth).toBe('2px')
}
export const AccountPhone: Story = {
  render: privacy(NO_EXPORT),
  globals: PHONE,
  play: async (context) => {
    await playAccountNarrow(context)
    // The tabs cut off at the edge fade out there, so the line reads as one to scroll.
    const line = within(context.canvasElement)
      .getByRole('navigation', { name: 'Settings sections' })
      .querySelector('ul') as HTMLElement
    await waitFor(() => expect(line).toHaveAttribute('data-more-end'))
    await expect(line).not.toHaveAttribute('data-more-start')
    const look = getComputedStyle(line)
    await expect(look.maskImage || look.webkitMaskImage).toMatch(/gradient/)
  },
}
export const AccountPhoneDaylight: Story = { ...AccountPhone, globals: { ...PHONE, ...DAYLIGHT } }
export const AccountTablet: Story = {
  render: privacy(NO_EXPORT),
  globals: TABLET,
  play: noSidewaysScroll,
}
/** Privacy (27 §3.9, 15 §4): training opt-in, "Download my data" and "Delete my account". */
export const Privacy: Story = {
  render: privacy(NO_EXPORT),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('switch', { name: 'Help improve transcriptions' }),
    ).not.toBeChecked()
    await expect(canvas.getByRole('button', { name: 'Prepare my data' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Delete account' })).toBeEnabled()
  },
}
export const PrivacyDaylight: Story = { render: privacy(NO_EXPORT), globals: DAYLIGHT }
export const PrivacyOffline: Story = {
  render: privacy(NO_EXPORT),
  beforeEach: () => {
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
    return () => {
      if (online) Object.defineProperty(Navigator.prototype, 'onLine', online)
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("You're offline. These settings need a connection."),
    ).toBeVisible()
    // Each control says why it can't be used, in its name.
    for (const name of [
      /^Delete account\s?, Unavailable offline$/,
      /^Prepare my data\s?, Unavailable/,
    ]) {
      const control = canvas.getByRole('button', { name })
      await expect(control).toBeDisabled()
      await expect(getComputedStyle(control).opacity).toBe('1')
    }
  },
}
export const PrivacyExportPending: Story = {
  render: privacy(
    { ...NO_EXPORT, status: 'pending', requested_at: new Date().toISOString() },
    { worker: false },
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Preparing your file/)).toBeVisible()
    await expect(
      canvas.getByText("Processing machine offline — your file will be prepared when it's back."),
    ).toBeVisible()
  },
}
export const PrivacyExportReady: Story = {
  render: privacy({
    status: 'ready',
    requested_at: new Date().toISOString(),
    ready_at: new Date().toISOString(),
    expires_at: IN_A_DAY,
    url: 'https://example.invalid/export.json',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Download my data' })).toHaveAttribute(
      'download',
    )
    await expect(canvas.getByText(/The link works until/)).toBeVisible()
  },
}
export const PrivacyExportFailed: Story = {
  render: privacy({ ...NO_EXPORT, status: 'failed', requested_at: new Date().toISOString() }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const failed = (await canvas.findByText("We couldn't prepare your file. Try again.")).closest(
      '[data-slot=inline-error]',
    ) as HTMLElement
    // The way to try again sits in the message, after what went wrong.
    await expect(within(failed).getByRole('button', { name: 'Prepare a new file' })).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'Prepare a new file' })).toHaveLength(1)
  },
}
/** The export state could not be loaded (unseeded query). */
export const PrivacyExportUnavailable: Story = {
  render: privacy(null),
  play: async ({ canvasElement }) => {
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    await expect(
      await within(canvasElement).findByText(
        "We couldn't check your data download. Try again.",
        undefined,
        { timeout: 10_000 },
      ),
    ).toBeVisible()
  },
}
export const PrivacyDeleteConfirm: Story = {
  render: privacy(NO_EXPORT),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: 'Delete account' }),
    )
    const dialog = within(canvasElement.ownerDocument.body).getByRole('alertdialog')
    // The confirmation says what goes, as the row does.
    await expect(dialog).toHaveTextContent(
      "Removes every song, stem, loop and edit. This can't be undone.",
    )
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible(),
    )
  },
}
export const PrivacyDeleteConfirmDaylight: Story = {
  ...PrivacyDeleteConfirm,
  globals: DAYLIGHT,
}
/** On a phone the buttons stack with Cancel on top, the destructive action under it. */
const deleteStacked: Story['play'] = async (context) => {
  await PrivacyDeleteConfirm.play?.(context)
  const dialog = within(context.canvasElement.ownerDocument.body).getByRole('alertdialog')
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' }).getBoundingClientRect()
  const remove = within(dialog)
    .getByRole('button', { name: 'Delete account' })
    .getBoundingClientRect()
  await expect(cancel.bottom).toBeLessThanOrEqual(remove.top)
}
export const PrivacyDeleteConfirmPhone: Story = {
  render: privacy(NO_EXPORT),
  globals: PHONE,
  play: deleteStacked,
}
export const PrivacyDeleteConfirmPhoneDaylight: Story = {
  ...PrivacyDeleteConfirmPhone,
  globals: { ...PHONE, ...DAYLIGHT },
}
export const PrivacyDeleteReauth: Story = {
  render: privacy(NO_EXPORT, { dialog: 'reauth' }),
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('alertdialog')
    await expect(dialog).toHaveTextContent("Confirm it's you")
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
    await waitFor(() => expect(confirm).toBeVisible())
    // Never disabled in advance: an empty password says so under the field and focuses it.
    await expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    const field = within(dialog).getByLabelText('Password')
    await expect(await within(dialog).findByText('Enter your password.')).toBeVisible()
    await expect(field).toHaveFocus()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(field, 'practice-slowly-42')
    await expect(within(dialog).queryByText('Enter your password.')).toBeNull()
  },
}
/** A Google-only account has no password: it signs in with Google again. */
export const PrivacyDeleteReauthGoogle: Story = {
  render: privacy(NO_EXPORT, { dialog: 'reauth', me: { ...ME, username: null } }),
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('alertdialog')
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Continue with Google' })).toBeVisible(),
    )
  },
}

/**
 * Keyboard & pedal (27 §3.9, Settings-Pedal Keys): the test area first, then each action as a row
 * with its keys; learning a pedal shows the prompt in that row, so it stays beside the control at
 * any width, and the row is marked current.
 */
const playKeyboard: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const test = await canvas.findByRole('button', { name: /Try a key or pedal here/ })
  const list = canvas.getByRole('region', { name: 'Keys' })
  await expect(test.getBoundingClientRect().top).toBeLessThan(list.getBoundingClientRect().top)
  const learn = canvas.getByRole('button', { name: 'Learn this pedal for Felt clean' })
  await userEvent.click(learn)
  const row = learn.closest('[data-slot=list-row]') as HTMLElement
  const prompt = within(row).getByText('Press the pedal or key for Felt clean. Escape cancels.')
  await expect(prompt).toBeVisible()
  await expect(row).toHaveAttribute('data-current')
  // The prompt wraps inside the screen rather than running off it (WCAG 1.4.10).
  await expect(prompt.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  await userEvent.keyboard('{PageDown}')
  await expect(row).toHaveTextContent('Page down')
  await expect(row).not.toHaveAttribute('data-current')
  await userEvent.click(canvas.getByRole('button', { name: 'Reset to the defaults' }))
  await expect(row).not.toHaveTextContent('Page down')
}
/** The fixed keys are listed too, as rows with no Learn button, named as the practice shortcuts
 * list names them; the pedal line is a statement, not a heading that looks pressable. */
const moreKeys: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const more = await canvas.findByRole('region', { name: 'More keys' })
  await expect(within(more).queryByRole('button')).toBeNull()
  const keysOf = (label: string | RegExp) =>
    [
      ...(
        within(more).getByText(label).closest('[data-slot=list-row]') as HTMLElement
      ).querySelectorAll('[data-slot=kbd]'),
    ].map((key) => key.textContent)
  await expect(keysOf('Loop 1, 2, 4 or 8 bars from here')).toEqual(['1', '2', '4', '8'])
  await expect(keysOf('Speed 50 to 100 %')).toEqual(['⇧5', '⇧6', '⇧7', '⇧8', '⇧9', '⇧0'])
  await expect(keysOf(/^Slower or faster by 1/)).toEqual(['⇧,', '⇧.'])
  await expect(keysOf('Keyboard shortcuts')).toEqual(['?'])
  await expect(keysOf('Command palette')).toEqual(['⌘ K', 'Ctrl K'])
  await expect(canvas.queryByRole('heading', { name: /^Page-turner pedals/ })).toBeNull()
  await expect(canvas.getByText(/^Page-turner pedals work straight away/)).toBeVisible()
}

export const Keyboard: Story = {
  render: () => shell('keyboard', <KeyboardSettings />),
  play: async (context) => {
    await moreKeys(context)
    await playKeyboard(context)
  },
}

export const KeyboardDaylight: Story = {
  render: () => shell('keyboard', <KeyboardSettings />),
  globals: DAYLIGHT,
  play: moreKeys,
}

/** Reached from practice's "Set it up" (`/settings/keyboard#pedal`): the left pedal's Learn button
 * has focus, so one press starts learning it. */
const fromPedalLink: Story['play'] = async ({ canvasElement }) => {
  const learn = await within(canvasElement).findByRole('button', {
    name: /^Learn this pedal for Left pedal/,
  })
  await waitFor(() => expect(learn).toHaveFocus())
  await userEvent.keyboard('{Enter}')
  await expect(learn).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{Escape}')
}

export const KeyboardFromPedalLink: Story = {
  render: () => (
    <AppStory path="/settings/keyboard#pedal">
      <AppShell me={ME}>
        <SettingsLayout>
          <KeyboardSettings />
        </SettingsLayout>
      </AppShell>
    </AppStory>
  ),
  play: fromPedalLink,
}

export const KeyboardFromPedalLinkDaylight: Story = {
  ...KeyboardFromPedalLink,
  globals: DAYLIGHT,
}
export const KeyboardPhone: Story = {
  render: () => shell('keyboard', <KeyboardSettings />),
  globals: PHONE,
  play: async (context) => {
    await noSidewaysScroll(context)
    // Action names wrap whole; none is cut off mid-word.
    for (const title of context.canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot=list-row-title] > span',
    )) {
      await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1)
    }
    await playKeyboard(context)
  },
}
export const KeyboardPhoneDaylight: Story = {
  ...KeyboardPhone,
  globals: { ...PHONE, ...DAYLIGHT },
}

/** About (27 §3.9): version, models from the register, font licences, the register. */
export const About: Story = {
  render: () => shell('about', <AboutSettings />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1, name: 'About' })).toBeVisible()
    await expect(canvas.getByText(/^(Version \w+, built|Built) /)).toBeVisible()
    await expect(canvas.getAllByRole('link', { name: 'SIL Open Font License 1.1' })).toHaveLength(4)
    // The models are developer provenance: folded away until asked for.
    const basic = canvas.getByText(/^Basic Pitch/)
    await expect(basic).not.toBeVisible()
    await userEvent.click(canvas.getByText(/^Show all \d+ models$/))
    await expect(basic).toBeVisible()
  },
}
export const AboutDaylight: Story = {
  render: () => shell('about', <AboutSettings />),
  globals: DAYLIGHT,
}
export const AboutPhone: Story = {
  render: () => shell('about', <AboutSettings />),
  globals: PHONE,
  play: async (context) => {
    await noSidewaysScroll(context)
    await headingNearTop(context)
  },
}
