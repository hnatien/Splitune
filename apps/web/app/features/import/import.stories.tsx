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

// Add song states (27 §3.6, §4; AddSong and Phone-Add): the one-column dialog over the library (a
// full-screen sheet on phones) on each tab, a picked file with Title and Artist, the part rows
// with Hand for fretted parts, Welcome, cap reached, recording not available, what a too-early
// submit says, and the file's own states (reading, warnings, preview after upload, duplicate, too
// long, unreadable), in Dark and Light.
const meta = { title: 'Screens/Import', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const TABLET = { viewport: { value: 'tablet', isRotated: false } }
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

// The primary is never disabled in advance (s47 direction §6): pressed too early, it says what is
// missing beside the cause and moves focus there.
const playDropZone: Story['play'] = async () => {
  const add = await dialog()
  const file = add.getByRole('tab', { name: 'File' })
  await expect(file).toHaveAttribute('aria-selected', 'true')
  // Focus starts on the chosen tab, not the close button.
  await waitFor(() => expect(file).toHaveFocus())
  const choose = await add.findByRole('button', { name: 'choose a file' })
  const start = add.getByRole('button', { name: 'Start practising' })
  await expect(start).toBeEnabled()
  await userEvent.click(start)
  await expect(await add.findByText('Choose or drop a file first.')).toBeVisible()
  await waitFor(() => expect(choose).toHaveFocus())
}

export const DropZone: Story = {
  render: page(),
  play: async (context) => {
    await playDropZone(context)
    const add = await dialog()
    // Your part comes from the profile; the Welcome analysis is the default (27 §3.6).
    const guitar = add.getByRole('radio', { name: 'Guitar' })
    await expect(guitar).toBeChecked()
    // Chosen is the ink edge and a check, not a wash (26 §12.1 ChoiceRow).
    await expect(getComputedStyle(guitar).boxShadow).toContain('1.5px')
    await expect(add.getByRole('radio', { name: /^Full/ })).toBeChecked()
    await expect(add.getByText('Welcome · free')).toBeVisible()
    await expect(add.getByText('4 of 5 left')).toBeVisible()
    await userEvent.click(add.getByRole('radio', { name: /^Lite/ }))
    await expect(
      add.getByText('Your first full analysis is free — your part isolated, plus tab.'),
    ).toBeVisible()
    await userEvent.click(add.getByRole('button', { name: 'Use it now' }))
    await expect(add.getByRole('radio', { name: /^Full/ })).toBeChecked()
    // One filled control in the dialog.
    await expect(
      document.querySelectorAll('[data-slot=add-song] [data-variant=primary]'),
    ).toHaveLength(1)
  },
}
export const DropZoneDaylight: Story = { render: page(), play: playDropZone, globals: DAYLIGHT }

const playSheet: Story['play'] = async () => {
  const add = await dialog()
  const sheet = document.querySelector<HTMLElement>('[data-slot=add-song]') as HTMLElement
  // Phone-Add: a full-screen sheet with the same column; the tabs keep 44 px targets.
  await waitFor(() => expect(sheet.getBoundingClientRect().width).toBe(window.innerWidth))
  await expect(add.getByRole('tab', { name: 'Record' }).getBoundingClientRect().height).toBe(44)
  await expect(add.getByRole('radio', { name: /^Full/ })).toBeVisible()
  await expect(add.getByRole('radio', { name: /^Lite/ })).toBeVisible()
  await expect(add.queryByRole('button', { name: 'Cancel' })).toBeNull()
  await expect(sheet.scrollWidth).toBeLessThanOrEqual(sheet.clientWidth)
}
export const Sheet: Story = { render: page(ME, 'record'), play: playSheet, globals: PHONE }
export const SheetDaylight: Story = {
  render: page(ME, 'record'),
  play: playSheet,
  globals: { ...PHONE, ...DAYLIGHT },
}

// Cap reached (23 §5): each used-up row says "Unavailable", the reason and the way to Plus sit
// right under the rows, and a submit moves focus there.
export const CapReached: Story = {
  render: page(ME_CAPPED),
  play: async () => {
    const add = await dialog()
    await expect(await add.findByText(/Full analyses are part of Plus/)).toBeVisible()
    await expect(add.getByText(/You've used this month's 5 Lite analyses/)).toBeVisible()
    await expect(add.getAllByRole('button', { name: 'See Plus' })).toHaveLength(2)
    await expect(add.getAllByText('Unavailable')).toHaveLength(2)
    for (const name of [/^Full/, /^Lite/]) {
      await expect(add.getByRole('radio', { name })).toHaveAttribute('aria-disabled', 'true')
    }
    await userEvent.click(add.getByRole('button', { name: 'Start practising' }))
    await waitFor(() => expect(add.getAllByRole('button', { name: 'See Plus' })[0]).toHaveFocus())
  },
}
export const CapReachedDaylight: Story = { ...CapReached, globals: DAYLIGHT }

export const PlusCapReached: Story = {
  render: page(ME_PLUS_CAPPED),
  play: async () => {
    const add = await dialog()
    await expect(await add.findByText(/You've used this period's 15 full analyses/)).toBeVisible()
    await expect(add.getByRole('radio', { name: /^Lite/ })).toBeChecked()
    await expect(add.queryByRole('button', { name: 'See Plus' })).toBeNull()
  },
}

/** Hand is the profile's handedness and only applies to fretted parts (guitar and bass). */
const playHand: Story['play'] = async () => {
  const add = await dialog()
  const hand = add.getByRole('group', { name: 'Hand' })
  await expect(within(hand).getByRole('button', { name: 'Right' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await userEvent.click(add.getByRole('radio', { name: 'Piano' }))
  await expect(add.getByRole('radio', { name: 'Piano' })).toBeChecked()
  await expect(add.queryByRole('group', { name: 'Hand' })).toBeNull()
  await userEvent.click(add.getByRole('radio', { name: 'Bass' }))
  await expect(add.getByRole('group', { name: 'Hand' })).toBeVisible()
}
export const PartAndHand: Story = { render: page(), play: playHand }
export const PartAndHandDaylight: Story = { render: page(), play: playHand, globals: DAYLIGHT }

// A bad link says what to enter under the field, on blur and on submit, and submit moves focus to
// the field (WCAG 3.3.1).
const playLink: Story['play'] = async () => {
  const add = await dialog()
  const field = add.getByLabelText('Link to a video or song')
  await userEvent.click(add.getByRole('button', { name: 'Add and analyse' }))
  await expect(await add.findByText('Enter a link that starts with https://')).toBeVisible()
  await waitFor(() => expect(field).toHaveFocus())
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await userEvent.type(field, 'not a link')
  await userEvent.tab()
  await expect(add.getByText('Enter a link that starts with https://')).toBeVisible()
  await expect(add.getByRole('switch', { name: 'Also download the video' })).toBeChecked()
  await expect(add.getByText(/Takes longer to download/)).toBeVisible()
  await expect(add.getByRole('button', { name: 'Add and analyse' })).toBeEnabled()
}
export const LinkTab: Story = { render: page(ME, 'link'), play: playLink }
export const LinkTabDaylight: Story = {
  render: page(ME, 'link'),
  play: playLink,
  globals: DAYLIGHT,
}
export const LinkTabPhone: Story = { render: page(ME, 'link'), play: playLink, globals: PHONE }

/** A file picked: hashed, decoded locally, the file, Title from the name, "Start practising". */
const playFileSelected: Story['play'] = async () => {
  const add = await dialog()
  const wav = new File([toneWav()], 'Riff in A minor.wav', { type: 'audio/wav' })
  const input = document.querySelector<HTMLInputElement>('[data-slot=add-song] input[type=file]')
  if (!input) throw new Error('no file input')
  await userEvent.upload(input, wav)
  await waitFor(
    () => expect(add.getByRole('img', { name: /^Waveform of Riff in A minor\.wav/ })).toBeVisible(),
    { timeout: 10_000 },
  )
  await expect(add.getByRole('button', { name: 'Start practising' })).not.toHaveAttribute(
    'aria-busy',
  )
  await expect(add.getByText('Riff in A minor.wav')).toBeVisible()
  await expect(add.getByLabelText('Title')).toHaveValue('Riff in A minor')
  await expect(add.getByPlaceholderText('Who plays it')).toBeVisible()
  await expect(add.getByRole('button', { name: 'Remove file' })).toBeVisible()
}
export const FileSelected: Story = { render: page(), play: playFileSelected }
export const FileSelectedDaylight: Story = {
  render: page(),
  play: playFileSelected,
  globals: DAYLIGHT,
}
export const FileSelectedTablet: Story = {
  render: page(),
  play: playFileSelected,
  globals: TABLET,
}

// Browsers without MediaRecorder (Playwright's WebKit) get the unsupported note instead.
const canRecord = () =>
  typeof MediaRecorder === 'function' && typeof navigator.mediaDevices?.getUserMedia === 'function'

// The Record tab never draws over Your part: the part rows start below the panel at any width.
const playRecord: Story['play'] = async () => {
  const add = await dialog()
  await expect(
    canRecord()
      ? add.getByRole('button', { name: 'Allow microphone' })
      : add.getByText(/Recording isn't available in this browser/),
  ).toBeVisible()
  const panel = document.querySelector('[data-record]') as HTMLElement
  const part = add.getByText('Your part')
  await expect(part.getBoundingClientRect().top).toBeGreaterThan(
    panel.getBoundingClientRect().bottom,
  )
  await userEvent.click(add.getByRole('button', { name: 'Use this recording' }))
  await expect(await add.findByText('Record a take first, then use it.')).toBeVisible()
}
export const RecordTab: Story = { render: page(ME, 'record'), play: playRecord }
export const RecordTabDaylight: Story = {
  render: page(ME, 'record'),
  play: playRecord,
  globals: DAYLIGHT,
}

// No recording in this browser: the note points to the other two ways in.
export const RecordUnsupported: Story = {
  render: page(ME, 'record'),
  beforeEach: () => {
    const original = Object.getOwnPropertyDescriptor(window, 'MediaRecorder')
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: undefined })
    return () => {
      if (original) Object.defineProperty(window, 'MediaRecorder', original)
    }
  },
  play: async () => {
    const add = await dialog()
    await expect(add.getByText(/Recording isn't available in this browser/)).toBeVisible()
    await userEvent.click(add.getByRole('button', { name: 'Paste a link' }))
    await expect(add.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true')
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
// Checks that don't block are a glyph and words each, never a tinted badge.
const playWarnings: Story['play'] = async ({ canvasElement }) => {
  const checks = within(within(canvasElement).getByRole('list', { name: 'File checks' }))
  await expect(checks.getAllByRole('listitem')).toHaveLength(2)
  await expect(checks.getByText(/very quiet/)).toBeVisible()
  await expect(canvasElement.querySelector('[data-slot=badge]')).toBeNull()
}
export const FileWarnings: Story = {
  render: row(decoded({ issues: [{ kind: 'quiet' }, { kind: 'clipping' }] })),
  play: playWarnings,
}
export const FileWarningsDaylight: Story = {
  render: row(decoded({ issues: [{ kind: 'quiet' }, { kind: 'clipping' }] })),
  play: playWarnings,
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
// A file that can't be used says why, what works, and offers another file.
const playBlocked: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('alert')).toHaveTextContent(/MP3, M4A, WAV/)
  await expect(canvas.getByRole('button', { name: 'Choose another file' })).toBeVisible()
}
export const FileTooLong: Story = {
  render: row(decoded({ issues: [{ kind: 'too_long', durationS: 1500 }] })),
  play: playBlocked,
}
export const FileUnreadable: Story = {
  render: row({
    file,
    status: 'ready',
    audio: { kind: 'unreadable' },
    issues: [],
    unreadable: true,
  }),
  play: playBlocked,
}
export const FileUnreadableDaylight: Story = { ...FileUnreadable, globals: DAYLIGHT }
