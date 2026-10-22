import chords from '@splitune/contracts/fixtures/chords.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { GlanceView } from './glance-view'
import { PracticeProvider } from './practice-context'
import { PracticePage } from './practice-page'
import { ALL, type Kind, type Patch, SONG_ID, seed, tone } from './practice-story-data'

// The practice screen (27 §3.7) on the contracts' 8-bar Am–F–C–G fixture: the progressive states
// as artefacts land (§3.7.3), the chords-only fallback, the editor and mixer overlays, Dark and
// Stage, and the phone glance view. Audio is a generated tone; nothing reaches the network.
const meta = { title: 'Screens/Practice', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const screen =
  (kinds: Kind[], patch: Patch = {}) =>
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
    // The chord sheet's code loads on demand.
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
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

/** Stems removed after 180 days unused: the song's own audio plays, "Re-create stems" (27 §5.6). */
export const StemsExpired: Story = {
  render: screen(ALL, { stemsPurged: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByText(
        'The stems for this song were removed after 180 days unused. Your loops and edits are safe.',
      ),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Re-create stems' })).toBeVisible()
  },
}

/** Stage: chrome reduced to the transport and the loop badge; reading sizes +1 step. */
export const ReadyStage: Story = { render: screen(ALL), globals: { appearance: 'stage' } }

export const ReadyAtTheStand: Story = {
  render: screen(ALL),
  globals: { distance: 'stand' },
}

// A chord every half bar from 12 names (like the "Stitch Up" example): more chips than fit.
const NAMES = [
  'E:min7',
  'A:7',
  'D:maj7',
  'B:hdim7',
  'G:sus4',
  'C:maj7',
  'F#:min7',
  'Bb:maj',
  'Eb:dim',
  'Ab:aug',
  'Db:maj7',
  'C:min7',
]
const MANY_CHORDS = {
  ...chords,
  segments: Array.from({ length: 16 }, (_, i) => {
    const label = NAMES[i % NAMES.length] as string
    const confidence = [0.92, 0.7, 0.45][i % 3] as number
    return {
      id: `c${String(i).padStart(4, '0')}`,
      confidence,
      confidence_raw: confidence,
      t0: 0.5 + i * 1.2,
      t1: 0.5 + (i + 1) * 1.2,
      label,
      top_k: [{ label, prob: confidence }],
      beat_aligned: true,
    }
  }),
}

/** Many chords: the chips clip inside their own area and the legend keeps its space. */
export const ManyChords: Story = {
  render: screen(ALL, { chords: MANY_CHORDS }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const list = await canvas.findByRole('list', { name: 'Chords' })
    // At the start: the first chord and the five after it.
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(6))
    // Nothing of a chip paints past the list's own edge.
    const box = list.getBoundingClientRect()
    const past = canvasElement.ownerDocument.elementFromPoint(
      box.right + 1,
      box.top + box.height / 2,
    )
    await expect(past?.closest('[data-slot=chord-chip]')).toBeNull()
  },
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
