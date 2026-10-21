import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { ME, ME_CAPPED } from '../story-fixtures'
import { FileRow } from './file-row'
import { ImportPage } from './import-page'
import type { PickedFile } from './use-picked-file'

// Import screen states (27 §3.6, §4): drop zone, cap reached, the picked file's row (reading,
// waveform with pre-flight warnings, preview after upload, duplicate, too long), Link and Record.
const meta = { title: 'Screens/Import', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const page =
  (me = ME) =>
  () => (
    <AppStory path="/import">
      <AppShell me={me}>
        <ImportPage me={me} />
      </AppShell>
    </AppStory>
  )

export const DropZone: Story = {
  render: page(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: 'choose a file' })).toBeVisible()
    await expect(canvas.getByRole('radio', { name: /Full/ })).toBeChecked()
    await expect(canvas.getByRole('button', { name: 'Start practising' })).toBeDisabled()
  },
}
export const DropZoneDark: Story = { render: page(), globals: { appearance: 'dark' } }

export const CapReached: Story = {
  render: page(ME_CAPPED),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Full analyses are part of Plus/)).toBeVisible()
    await expect(canvas.getByText(/You've used this month's 5 Lite analyses/)).toBeVisible()
  },
}

export const LinkTab: Story = {
  render: page(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: 'Link' }))
    await userEvent.type(canvas.getByLabelText('Link to a video or song'), 'not a link')
    await userEvent.tab()
    await expect(canvas.getByText('Enter a link that starts with https://')).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Also download the video' })).toBeChecked()
  },
}

export const RecordTab: Story = {
  render: page(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: 'Record' }))
    await expect(canvas.getByRole('button', { name: 'Allow microphone' })).toBeVisible()
  },
}

const file = new File([new Uint8Array(3_800_000)], 'Riff in A minor.mp3', { type: 'audio/mpeg' })
const PEAKS = Array.from({ length: 400 }, (_, i) =>
  Math.max(0.05, 0.85 * Math.exp(-4 * ((i % 25) / 25))),
)
const decoded = (patch: Partial<PickedFile> = {}): PickedFile => ({
  file,
  status: 'ready',
  sha256: 'a'.repeat(64),
  audio: {
    kind: 'decoded',
    stats: { durationS: 222, peaks: PEAKS, rmsDb: -18, clippedFraction: 0, silentFraction: 0.05 },
  },
  issues: [],
  unreadable: false,
  ...patch,
})

const row = (picked: PickedFile) => () => (
  <AppStory>
    <div className="max-w-xl p-6">
      <FileRow picked={picked} onRemove={() => undefined} onImportAnyway={() => undefined} />
    </div>
  </AppStory>
)

export const FileReading: Story = {
  render: row({ file, status: 'reading', issues: [], unreadable: false }),
}
export const FileReady: Story = { render: row(decoded()) }
export const FileWarnings: Story = {
  render: row(decoded({ issues: [{ kind: 'quiet' }, { kind: 'clipping' }] })),
}
export const FilePreviewAfterUpload: Story = {
  render: row(decoded({ audio: { kind: 'needs_upload', durationS: 95 } })),
}
export const FileDuplicate: Story = {
  render: row(decoded({ duplicateOf: '00000000-0000-4000-8000-000000000001' })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('You already have this song.')).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Open it' })).toBeVisible()
  },
}
export const FileTooLong: Story = {
  render: row(decoded({ issues: [{ kind: 'too_long', durationS: 1500 }] })),
}
export const FileUnreadable: Story = {
  render: row({
    file,
    status: 'ready',
    audio: { kind: 'unreadable' },
    issues: [],
    unreadable: true,
  }),
}
export const FileWarningsStage: Story = {
  render: row(decoded({ issues: [{ kind: 'mostly_silent' }] })),
  globals: { appearance: 'stage' },
}
