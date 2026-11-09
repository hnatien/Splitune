import type { DataExportState, WorkerStatus } from '@splitune/contracts'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { z } from 'zod'
import { useDisplay } from '@/lib/display-store'
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

// Settings (27 §3.9): Account (Profile, Plan, Privacy, Sign out), Display & practice, Keyboard &
// pedal and About, in Night Rehearsal (the default), Daylight and on a phone. The Privacy stories
// render Account (Privacy is one of its sections) and keep their ids for the visual matrix.
const meta = { title: 'Screens/Settings', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const DAYLIGHT = { appearance: 'light' }
const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

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

/** Display & practice (27 §3.9, Settings-Display): appearance cards, reading, motion, defaults. */
export const Display: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cards = await canvas.findByRole('radiogroup', { name: 'Appearance' })
    await expect(within(cards).getAllByRole('radio')).toHaveLength(3)
    await expect(within(cards).getByRole('radio', { name: 'Night Rehearsal' })).toBeChecked()
    await expect(canvas.getByText('Saved on this device')).toBeVisible()
    await expect(
      canvas.getByText('Can you read the fret numbers from where you play?'),
    ).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Hyperlegible font' })).not.toBeChecked()
    await expect(canvas.getByRole('switch', { name: 'Left-handed' })).not.toBeChecked()
    await expect(canvas.queryByText('Score')).toBeNull()
  },
}
export const DisplayDaylight: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  globals: DAYLIGHT,
}
export const DisplayPhone: Story = {
  render: () => shell('display', <DisplaySettings me={ME} />),
  globals: PHONE,
  play: noSidewaysScroll,
}
/** A stored `stage` (26 §2, D2) has no card: it shows Night Rehearsal and the distance it raised. */
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
    await expect(within(cards).getByRole('radio', { name: 'Night Rehearsal' })).toBeChecked()
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

/** Account (27 §3.9, Settings-Account): Profile, Plan, Privacy and Sign out. */
export const Account: Story = {
  render: privacy(NO_EXPORT),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
    await expect(canvas.getByLabelText('Name')).toHaveValue('Ana')
    await expect(canvas.getByRole('group', { name: 'Main instrument' })).toBeVisible()
    await expect(canvas.getByRole('group', { name: 'How long have you played?' })).toBeVisible()
    await expect(canvas.getByText('Demo billing')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'See Plus' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeVisible()
  },
}
export const AccountDaylight: Story = { render: privacy(NO_EXPORT), globals: DAYLIGHT }
export const AccountPhone: Story = {
  render: privacy(NO_EXPORT),
  globals: PHONE,
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
    await expect(canvas.getByRole('button', { name: 'Delete account' })).toBeDisabled()
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
    await expect(await canvas.findByText("We couldn't prepare your file. Try again.")).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Prepare a new file' })).toBeVisible()
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
    await expect(dialog).toHaveTextContent(
      "Delete your account and everything in it? This can't be undone.",
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
export const PrivacyDeleteReauth: Story = {
  render: privacy(NO_EXPORT, { dialog: 'reauth' }),
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('alertdialog')
    await expect(dialog).toHaveTextContent("Confirm it's you")
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
    await waitFor(() => expect(confirm).toBeVisible())
    await expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText('Password'), 'practice-slowly-42')
    await expect(confirm).toBeEnabled()
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

/** Keyboard & pedal (27 §3.9, Settings-Pedal Keys): the table, learning a key, the test area. */
export const Keyboard: Story = {
  render: () => shell('keyboard', <KeyboardSettings />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Learn this pedal for Felt clean' }))
    await expect(
      canvas.getByText('Press the pedal or key for Felt clean. Escape cancels.'),
    ).toBeVisible()
    await userEvent.keyboard('{PageDown}')
    await expect(canvas.getByRole('row', { name: /Felt clean/ })).toHaveTextContent('Page down')
    await userEvent.click(canvas.getByRole('button', { name: 'Reset to the defaults' }))
  },
}

export const KeyboardDaylight: Story = {
  render: () => shell('keyboard', <KeyboardSettings />),
  globals: DAYLIGHT,
}
export const KeyboardPhone: Story = {
  render: () => shell('keyboard', <KeyboardSettings />),
  globals: PHONE,
  play: noSidewaysScroll,
}

/** About (27 §3.9): version, models from the register, font licences, the register. */
export const About: Story = {
  render: () => shell('about', <AboutSettings />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1, name: 'About' })).toBeVisible()
    await expect(canvas.getByText(/^(Version \w+, built|Built) /)).toBeVisible()
    await expect(canvas.getAllByRole('link', { name: 'SIL Open Font License 1.1' })).toHaveLength(4)
    await expect(canvas.getByText(/^Basic Pitch/)).toBeVisible()
  },
}
export const AboutDaylight: Story = {
  render: () => shell('about', <AboutSettings />),
  globals: DAYLIGHT,
}
export const AboutPhone: Story = {
  render: () => shell('about', <AboutSettings />),
  globals: PHONE,
  play: noSidewaysScroll,
}
