import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { MeData } from '@/lib/session'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { LibraryPage } from '../library/library-page'
import { libraryQuery, statsQuery, workerStatusQuery } from '../library/queries'
import { toneWav } from '../practice/practice-story-data'
import { AppShell } from '../shell/app-shell'
import { LIBRARY, ME, ME_CAPPED, ME_PLUS_CAPPED, STATS, WORKER_ONLINE } from '../story-fixtures'
import { FileRow } from './file-row'
import type { PickedFile } from './use-picked-file'

// Add song states (27 §3.6, §4; AddSong and Phone-Add): the dialog over the library (a full-screen
// sheet on phones) on each tab, a picked file with its card, Title and Artist, Welcome, cap reached,
// and the file card's own states (reading, warnings, preview after upload, duplicate, too long,
// unreadable), in Night Rehearsal and Daylight.
const meta = { title: 'Screens/Import', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const DAYLIGHT = { appearance: 'light' }

const seed = (me: MeData) => (client: QueryClient) => {
  client.setQueryData(meQuery.queryKey, me)
  client.setQueryData(libraryQuery({}).queryKey, {
    pages: [{ items: LIBRARY, next_cursor: null }],
    pageParams: [undefined],
  })
  client.setQueryData(workerStatusQuery.queryKey, WORKER_ONLINE)
  client.setQueryData(statsQuery.queryKey, STATS)
}

// The tab is remembered on the device; each story starts from the one it names.
const page =
  (me: MeData = ME, add: 'file' | 'link' | 'record' = 'file') =>
  () => (
    <AppStory path={`/library?add=${add}`} seed={seed(me)}>
      <AppShell me={me}>
        <LibraryPage search={{}} />
      </AppShell>
    </AppStory>
  )

// The dialog is a lazy chunk: on a cold dev server Vite compiles it on first request, which can
// take longer than Testing Library's 1 s default when many stories run at once.
const LAZY = { timeout: 10_000 }

const dialog = async () => {
  const add = await within(document.body).findByRole('dialog', undefined, LAZY)
  // The dialog fades and zooms in (26 §10); wait until it has.
  await waitFor(() =>
    expect(within(add).getByRole('heading', { name: 'Add a song' })).toBeVisible(),
  )
  return within(add)
}

const playDropZone: Story['play'] = async () => {
  const add = await dialog()
  await expect(add.getByRole('heading', { name: 'Add a song' })).toBeVisible()
  await expect(await add.findByRole('button', { name: 'choose a file' })).toBeVisible()
  await expect(add.getByRole('tab', { name: 'File' })).toHaveAttribute('aria-selected', 'true')
  await expect(add.getByRole('button', { name: 'Start practising' })).toBeDisabled()
}

export const DropZone: Story = {
  render: page(),
  play: async (context) => {
    await playDropZone(context)
    const add = await dialog()
    // Your part comes from the profile; the Welcome analysis is the default (27 §3.6).
    await expect(add.getByRole('radio', { name: 'Guitar' })).toBeChecked()
    await expect(add.getByRole('radio', { name: /^Full/ })).toBeChecked()
    await expect(add.getByText('Welcome · free')).toBeVisible()
    await expect(add.getByText('4 of 5 left')).toBeVisible()
    await userEvent.click(add.getByRole('radio', { name: /^Lite/ }))
    await expect(
      add.getByText('Your first full analysis is free — your part isolated, plus tab.'),
    ).toBeVisible()
    await userEvent.click(add.getByRole('button', { name: 'Use it now' }))
    await expect(add.getByRole('radio', { name: /^Full/ })).toBeChecked()
  },
}
export const DropZoneDaylight: Story = { render: page(), play: playDropZone, globals: DAYLIGHT }

const playSheet: Story['play'] = async () => {
  const add = await dialog()
  const sheet = document.querySelector<HTMLElement>('[data-slot=add-song]') as HTMLElement
  // Phone-Add: a full-screen sheet with 48 px tabs, part chips and the Full · Lite segments.
  await waitFor(() => expect(sheet.getBoundingClientRect().width).toBe(window.innerWidth))
  await expect(add.getByRole('tab', { name: 'Record' }).getBoundingClientRect().height).toBe(48)
  await expect(add.getByRole('button', { name: 'Full · free once' })).toBeVisible()
  await expect(add.getByRole('button', { name: 'Lite · 4 left' })).toBeVisible()
  await expect(add.queryByRole('button', { name: 'Cancel' })).toBeNull()
}
export const Sheet: Story = { render: page(ME, 'record'), play: playSheet, globals: PHONE }
export const SheetDaylight: Story = {
  render: page(ME, 'record'),
  play: playSheet,
  globals: { ...PHONE, ...DAYLIGHT },
}

export const CapReached: Story = {
  render: page(ME_CAPPED),
  play: async () => {
    const add = await dialog()
    await expect(await add.findByText(/Full analyses are part of Plus/)).toBeVisible()
    await expect(add.getByText(/You've used this month's 5 Lite analyses/)).toBeVisible()
    await expect(add.getAllByRole('button', { name: 'See Plus' })).toHaveLength(2)
  },
}

export const PlusCapReached: Story = {
  render: page(ME_PLUS_CAPPED),
  play: async () => {
    const add = await dialog()
    await expect(await add.findByText(/You've used this period's 15 full analyses/)).toBeVisible()
    await expect(add.getByRole('radio', { name: /^Lite/ })).toBeChecked()
    await expect(add.queryByRole('button', { name: 'See Plus' })).toBeNull()
  },
}

const playLink: Story['play'] = async () => {
  const add = await dialog()
  await userEvent.type(add.getByLabelText('Link to a video or song'), 'not a link')
  await userEvent.tab()
  await expect(add.getByText('Enter a link that starts with https://')).toBeVisible()
  await expect(add.getByRole('switch', { name: 'Also download the video' })).toBeChecked()
  await expect(add.getByRole('button', { name: 'Add and analyse' })).toBeDisabled()
}
export const LinkTab: Story = { render: page(ME, 'link'), play: playLink }
export const LinkTabDaylight: Story = {
  render: page(ME, 'link'),
  play: playLink,
  globals: DAYLIGHT,
}

/** A file picked: hashed, decoded locally, the file card, Title from the name, "Start practising". */
const playFileSelected: Story['play'] = async () => {
  const add = await dialog()
  const wav = new File([toneWav()], 'Riff in A minor.wav', { type: 'audio/wav' })
  const input = document.querySelector<HTMLInputElement>('[data-slot=add-song] input[type=file]')
  if (!input) throw new Error('no file input')
  await userEvent.upload(input, wav)
  await waitFor(() => expect(add.getByRole('button', { name: 'Start practising' })).toBeEnabled(), {
    timeout: 10_000,
  })
  await expect(add.getByText('Riff in A minor.wav')).toBeVisible()
  await expect(add.getByLabelText('Title')).toHaveValue('Riff in A minor')
  await expect(add.getByPlaceholderText('Who plays it')).toBeVisible()
  await expect(add.getByText('Drop another file here, or')).toBeVisible()
}
export const FileSelected: Story = { render: page(), play: playFileSelected }
export const FileSelectedDaylight: Story = {
  render: page(),
  play: playFileSelected,
  globals: DAYLIGHT,
}

export const RecordTab: Story = {
  render: page(ME, 'record'),
  play: async () => {
    const add = await dialog()
    await expect(add.getByRole('button', { name: 'Allow microphone' })).toBeVisible()
    await expect(add.getByRole('button', { name: 'Use this recording' })).toBeDisabled()
  },
}

// "Works best with" (27 §3.6): a disclosure in the footer; G4 checks its place with the owner.
export const WorksBest: Story = {
  render: page(),
  play: async () => {
    const add = await dialog()
    await userEvent.click(add.getByRole('button', { name: 'What works best?' }))
    const note = await within(document.body).findByText(/Works best with studio recordings/)
    await waitFor(() => expect(note).toBeVisible())
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
export const FileWarningsDaylight: Story = {
  render: row(decoded({ issues: [{ kind: 'quiet' }, { kind: 'clipping' }] })),
  globals: DAYLIGHT,
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
    await expect(canvas.getByRole('button', { name: 'Add anyway' })).toBeVisible()
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
