import type { Analysis, SongDetail } from '@splitune/contracts'
import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import stems from '@splitune/contracts/fixtures/stems.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { z } from 'zod'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { statsQuery, workerStatusQuery } from '../library/queries'
import { analysis, detail, ME, STATS, WORKER_ONLINE } from '../story-fixtures'
import { GlanceView } from './glance-view'
import type { FetchAudio } from './practice-context'
import { PracticeProvider } from './practice-context'
import { PracticePage } from './practice-page'

// The practice screen (27 §3.7) on the contracts' 8-bar Am–F–C–G fixture: the progressive states
// as artefacts land (§3.7.3), the chords-only fallback, the editor and mixer overlays, Dark and
// Stage, and the phone glance view. Audio is a generated tone; nothing reaches the network.
const meta = { title: 'Screens/Practice', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

type Kind = 'beats' | 'stems' | 'chords' | 'notes.guitar' | 'tab.guitar' | 'summary'
const DOCS: Partial<Record<Kind, unknown>> = {
  beats,
  stems,
  chords,
  'notes.guitar': notes,
  summary,
}
const ALL: Kind[] = ['beats', 'stems', 'chords', 'notes.guitar', 'tab.guitar', 'summary']
const artefactId = (kind: Kind) =>
  `00000000-0000-4000-9000-${String(ALL.indexOf(kind) + 1).padStart(12, '0')}`

function seed(kinds: Kind[], patch: { summary?: unknown; running?: boolean } = {}) {
  return (client: QueryClient) => {
    const run = analysis(1, patch.running ? 'running' : 'done')
    const entries = kinds.map((kind) => ({
      id: artefactId(kind),
      kind,
      version: 1,
      bytes: 100,
      sha256: '0'.repeat(64),
      created_at: '2026-10-22T10:00:00Z',
    }))
    const withArtefacts: z.infer<typeof Analysis> = { ...run, artefacts: entries }
    const song: z.infer<typeof SongDetail> = {
      ...detail(1, withArtefacts),
      duration_s: 20.5,
      artefacts: entries,
    }
    client.setQueryData(orpc.songs.get.queryKey({ input: { id: song.id } }), song)
    client.setQueryData(orpc.analyses.get.queryKey({ input: { id: run.id } }), withArtefacts)
    client.setQueryData(orpc.loops.list.queryKey({ input: { id: song.id } }), { items: [] })
    client.setQueryData(statsQuery.queryKey, STATS)
    client.setQueryData(workerStatusQuery.queryKey, WORKER_ONLINE)
    client.setQueryData(meQuery.queryKey, ME)
    for (const kind of kinds) {
      client.setQueryData(
        orpc.artefacts.listCorrections.queryKey({ input: { id: artefactId(kind) } }),
        { ops: [] },
      )
      const doc = kind === 'summary' && patch.summary ? patch.summary : DOCS[kind]
      if (doc) client.setQueryData(['artefact-doc', artefactId(kind)], doc)
    }
  }
}

// 20.5 s of a quiet plucked 220 Hz tone as a WAV, for every stem and the song's own audio.
const tone: FetchAudio = async () => {
  const rate = 22_050
  const frames = Math.round(20.5 * rate)
  const buffer = new ArrayBuffer(44 + frames * 2)
  const view = new DataView(buffer)
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) {
    const t = i / rate
    const sample = 0.3 * Math.exp(-3 * ((t + 0.1) % 0.6)) * Math.sin(2 * Math.PI * 220 * t)
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true)
  }
  return buffer
}

const SONG_ID = detail(1, null).id

const screen =
  (kinds: Kind[], patch: { summary?: unknown; running?: boolean } = {}) =>
  () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(kinds, patch)}>
      <PracticePage songId={SONG_ID} search={{}} fetchAudio={tone} />
    </AppStory>
  )

const playable = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeEnabled(), {
    timeout: 20_000,
  })
  return canvas
}

/** Local audio only (27 §3.7.3): the paper placeholder with the analysis stages. */
export const Analysing: Story = {
  render: screen([], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(canvas.getByText("Tab will appear here as soon as it's ready")).toBeVisible()
    await expect(canvas.getByRole('progressbar')).toBeVisible()
  },
}

/** + beats: bar numbers, bar-snapped loops, count-in available. */
export const BeatsFound: Story = {
  render: screen(['beats'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByRole('list', { name: 'Bars' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Count-in' })).toBeEnabled()
  },
}

/** + stems + chords: the chord strip and the chord sheet, the mixer, the audition banner. */
export const Chords: Story = {
  render: screen(['beats', 'stems', 'chords'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(sheet).toBeVisible())
    await expect(await canvas.findByRole('button', { name: 'Mix' })).toBeVisible()
  },
}

/** + tab: everything (the primary state). */
export const Ready: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
  },
}

export const ReadyDark: Story = { render: screen(ALL), globals: { appearance: 'dark' } }

/** Stage: chrome reduced to the transport and the loop badge; reading sizes +1 step. */
export const ReadyStage: Story = { render: screen(ALL), globals: { appearance: 'stage' } }

export const ReadyAtTheStand: Story = {
  render: screen(ALL),
  globals: { distance: 'stand' },
}

const CHORDS_ONLY = {
  ...summary,
  per_instrument: [
    {
      instrument: 'guitar',
      note_confidence_mean: 0.4,
      fraction_low_conf: 0.6,
      recommended_view: 'chords_only',
      reasons: ['low_confidence'],
    },
  ],
}

/** summary.recommended_view = chords_only: the banner with "Show tab anyway" (12 §4). */
export const ChordsOnlyFallback: Story = {
  render: screen(ALL, { summary: CHORDS_ONLY }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const show = await canvas.findByRole('button', { name: 'Show tab anyway' })
    await userEvent.click(show)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
  },
}

/** Tap a chord chip: the editor with the top-k alternatives as frequencies (27 §3.7.4). */
export const Editor: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const strip = await canvas.findByRole('list', { name: 'Chords' })
    await userEvent.click(await within(strip).findByRole('button', { name: /^G/ }))
    const body = within(canvasElement.ownerDocument.body)
    // The sheet's code loads on first open.
    const editor = await body.findByRole('dialog', { name: 'Edit this bar' }, { timeout: 10_000 })
    await expect(within(editor).getAllByText(/about 1 in \d+/i)[0]).toBeVisible()
  },
}

export const Mixer: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Mix' }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByRole('dialog', { name: 'Mix' }, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(body.getByText('Your part', { selector: '[data-slot=badge]' })).toBeVisible()
  },
}

/** Phone portrait default (26 §6.3): current and next chord, bar.beat, speed. */
export const Glance: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL)}>
      <PracticeProvider songId={SONG_ID} search={{}} fetchAudio={tone}>
        <div data-density="practice" className="flex h-[40rem] flex-col">
          <GlanceView />
        </div>
      </PracticeProvider>
    </AppStory>
  ),
  globals: { distance: 'floor' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('region', { name: 'Current chord' })).toBeVisible()
  },
}
