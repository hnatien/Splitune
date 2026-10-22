import type { DataExportState, WorkerStatus } from '@splitune/contracts'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { z } from 'zod'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { workerStatusQuery } from '../library/queries'
import { AppShell } from '../shell/app-shell'
import { ME } from '../story-fixtures'
import { DisplaySettings } from './display-settings'
import { KeyboardSettings } from './keyboard-settings'
import { type DeleteStep, exportStateQuery, PrivacySettings } from './privacy-settings'
import { ProfileSettings } from './profile-settings'

// Settings sections (27 §3.9): Profile, Display & practice, Keyboard & pedal and Privacy.
const meta = { title: 'Screens/Settings', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const shell = (children: React.ReactNode, seed?: (client: QueryClient) => void) => (
  <AppStory path="/settings/profile" {...(seed ? { seed } : {})}>
    <AppShell me={ME}>
      <div className="max-w-2xl">{children}</div>
    </AppShell>
  </AppStory>
)

export const Profile: Story = {
  render: () => shell(<ProfileSettings me={ME} />),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByLabelText('Name')).toHaveValue('Ana')
  },
}
export const ProfileDark: Story = {
  render: () => shell(<ProfileSettings me={ME} />),
  globals: { appearance: 'dark' },
}
export const Display: Story = {
  render: () => shell(<DisplaySettings />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText('Can you read the fret numbers from where you play?'),
    ).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Hyperlegible font' })).not.toBeChecked()
  },
}
export const DisplayStage: Story = {
  render: () => shell(<DisplaySettings />),
  globals: { appearance: 'stage' },
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
  (state: ExportState | null, options: { worker?: boolean; dialog?: DeleteStep } = {}) =>
  () =>
    shell(<PrivacySettings me={ME} deleteDialog={options.dialog} />, (client) => {
      client.setQueryData(meQuery.queryKey, ME)
      if (state) client.setQueryData(exportStateQuery(false).queryKey, state)
      const runner = { online: options.worker ?? true, last_heartbeat_at: null }
      const worker: z.infer<typeof WorkerStatus> = {
        online: runner.online,
        runners: { python: runner, node: runner },
      }
      client.setQueryData(workerStatusQuery.queryKey, worker)
    })

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
export const PrivacyDark: Story = { render: privacy(NO_EXPORT), globals: { appearance: 'dark' } }
export const PrivacyStage: Story = { render: privacy(NO_EXPORT), globals: { appearance: 'stage' } }
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
    await expect(
      await within(canvasElement).findByText("We couldn't check your data download. Try again."),
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
export const PrivacyDeleteReauth: Story = {
  render: privacy(NO_EXPORT, { dialog: 'reauth' }),
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('alertdialog')
    await expect(dialog).toHaveTextContent("Confirm it's you")
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Email me a link' })).toBeVisible(),
    )
  },
}
export const PrivacyDeleteLinkSent: Story = {
  render: privacy(NO_EXPORT, { dialog: 'sent' }),
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('alertdialog')
    await expect(dialog).toHaveTextContent(/We sent a link to/)
  },
}

/** Keyboard & pedal (27 §3.9): the binding table, "Learn this pedal" and the test area. */
export const Keyboard: Story = {
  render: () => shell(<KeyboardSettings />),
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

export const KeyboardDark: Story = {
  render: () => shell(<KeyboardSettings />),
  globals: { appearance: 'dark' },
}
