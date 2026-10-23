import chords from '@splitune/contracts/fixtures/chords.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { m } from '@/lib/i18n'
import { AppStory } from '../../../.storybook/app.tsx'
import { EditPage } from './edit-page'
import { GlanceView } from './glance-view'
import { PracticeProvider, type PracticeSearch } from './practice-context'
import { PracticeLoading } from './practice-loading'
import { PracticePage } from './practice-page'
import {
  ALL,
  type Kind,
  type Patch,
  PIANO_CHORDS,
  PIANO_SUMMARY,
  PIANO_SUMMARY_BELOW_GATE,
  SONG_ID,
  seed,
  tone,
} from './practice-story-data'

// The practice screen (27 §3.7) on the contracts' 8-bar Am–F–C–G fixture: the progressive states
// as artefacts land (§3.7.3), the chords-only fallback, the editor and mixer overlays, Dark and
// Stage, and the phone glance view. Audio is a generated tone; nothing reaches the network.
const meta = { title: 'Screens/Practice', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const screen =
  (kinds: Kind[], patch: Patch = {}, search: PracticeSearch = {}) =>
  () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(kinds, patch)}>
      <PracticePage songId={SONG_ID} search={search} fetchAudio={tone} />
    </AppStory>
  )

const playable = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeEnabled(), {
    timeout: 20_000,
  })
  return canvas
}

/** Loading (27 §4): the regions as skeletons; "Loading your song…" after 1 s. */
export const Loading: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`}>
      <PracticeLoading slowText={m['practice.loading']()} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement()
    await expect(
      await canvas.findByText('Loading your song…', undefined, { timeout: 3_000 }),
    ).toBeVisible()
  },
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

/** + beats: bar-snapped loops on the timeline, count-in available; the paper keeps the status. */
export const BeatsFound: Story = {
  render: screen(['beats'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByText('You can already loop and slow the original'),
    ).toBeVisible()
    await expect(canvas.queryByRole('list', { name: 'Bars' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Count-in' })).toBeEnabled()
  },
}

/** Pedal presses that can't act yet still answer in the PedalHud (12 §8): no loop, no stems. */
export const PedalBeforeLoop: Story = {
  render: screen(['beats'], { running: true }),
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    const hud = () => canvasElement.ownerDocument.querySelector('[data-slot=pedal-hud]')
    await userEvent.keyboard('c')
    await waitFor(() => expect(hud()).toHaveTextContent('No loop — tap two bars'))
    await userEvent.keyboard('m')
    await waitFor(() => expect(hud()).toHaveTextContent("Stems aren't ready yet"))
  },
}

/** + stems + chords: the chord strip and the chord sheet, and the mixer. */
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

/** Separation failed (27 §3.7.3): beat and chords are ready, the reason where the stems would be. */
export const StemsUnavailable: Story = {
  render: screen(['beats', 'chords'], { failedStage: 'separate' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByText(/Stems are unavailable right now; chords and beat are ready/),
    ).toBeVisible()
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

/** A loop on bars 5–6 from the URL (`?loop=5-6`): band, rail and A/B flags on the score, band on
 * the overview, badge, pass pair. */
export const LoopActive: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    // Every layout: the transport's badge (the glance view repeats it on phones).
    await expect((await canvas.findAllByText(/Loop · bars 5–6/))[0]).toBeVisible()
    await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // One rail per looped bar, with A on the first and B on the last — not a rule round each bar.
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot=loop-rail]')).toHaveLength(2),
    )
    const flags = [...canvasElement.querySelectorAll('[data-slot=loop-flag]')]
    await expect(flags.map((flag) => flag.textContent)).toEqual(['A', 'B'])
    const shade = canvasElement.querySelector<HTMLElement>('[data-slot=loop-shade]')
    await expect(shade && getComputedStyle(shade).borderTopWidth).toBe('0px')
  },
}

/** The status bar's Tab / Chords switch: the chord sheet, then back to the tab. */
export const ChordsView: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // The status bar's controls load with the bar.
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
    await waitFor(() => expect(sheet).toBeVisible())
    await expect(canvas.queryByRole('region', { name: 'Tab' })).toBeNull()
    await userEvent.click(within(view).getByRole('button', { name: 'Tab' }))
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
  },
}

/** A URL import's video: closed by default, a floating player from the status bar's toggle that
 * grows, shrinks and closes. */
export const WithVideo: Story = {
  render: screen(ALL, { video: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const pane = () => canvasElement.querySelector<HTMLElement>('[data-slot=video-pane]')
    await expect(pane()).toBeNull()
    await userEvent.click(await canvas.findByRole('button', { name: 'Video' }))
    // The player's code loads on first open.
    await waitFor(() => expect(pane()).toBeVisible(), { timeout: 10_000 })
    const small = pane()?.getBoundingClientRect().width ?? 0
    await userEvent.click(canvas.getByRole('button', { name: 'Larger video' }))
    await waitFor(() => expect(pane()?.getBoundingClientRect().width ?? 0).toBeGreaterThan(small))
    await userEvent.click(canvas.getByRole('button', { name: 'Hide video' }))
    await waitFor(() => expect(pane()).toBeNull())
    await expect(canvas.getByRole('button', { name: 'Video' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
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

/** No Screen Wake Lock (24 §3): from the first play, once per device, the "keep screen on" tip. */
export const ScreenMayLock: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true })
    localStorage.removeItem('splitune.screen-tip')
    return () => {
      Reflect.deleteProperty(navigator, 'wakeLock')
    }
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(canvas.queryByText(m['practice.screen_tip']())).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }))
    const tip = await canvas.findByText(m['practice.screen_tip'](), undefined, { timeout: 10_000 })
    await waitFor(() => expect(tip).toBeVisible())
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }))
  },
}

/** Offline with a song whose audio this device never stored (27 §4). */
export const NotSavedOffline: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    return () => {
      Reflect.deleteProperty(navigator, 'onLine')
    }
  },
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL)}>
      <PracticePage
        songId={SONG_ID}
        search={{}}
        fetchAudio={() => Promise.reject(new TypeError('Failed to fetch'))}
      />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notice = await canvas.findByText("This song isn't saved for offline yet.", undefined, {
      timeout: 10_000,
    })
    await waitFor(() => expect(notice).toBeVisible())
  },
}

/** Stage: chrome reduced to the transport, the overview and ⚙; reading sizes +1 step. */
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

/** Many chords: the names clip inside their own area and level/capo keep their space. */
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

const PIANO: Patch = { instrument: 'piano', chords: PIANO_CHORDS }
const PIANO_KINDS: Kind[] = ['beats', 'stems', 'chords', 'summary']

const pianoChart = async (canvasElement: HTMLElement) => {
  const canvas = await playable(canvasElement)
  // The chart's code loads on demand.
  const chart = await canvas.findByRole('region', { name: 'Chord chart' }, { timeout: 10_000 })
  // Layers fade in (200 ms, 27 §3.7.3).
  await waitFor(() => expect(chart).toBeVisible())
  return { canvas, chart: within(chart), element: chart }
}

/** Piano (V13): the chord chart, spelled in the song's key (E♭ major, though the model says
 * D#), four bars to a line, each chord once where it changes; the strip's keyboard voicing. */
export const Piano: Story = {
  render: screen(PIANO_KINDS, PIANO),
  play: async ({ canvasElement }) => {
    const { canvas, chart, element } = await pianoChart(canvasElement)
    await expect(chart.getByRole('button', { name: /^Bar 1\s*,\s*No chord$/ })).toBeVisible()
    await expect(
      chart.getByRole('button', { name: /^Bar 3\s*,\s*A♭maj7\s*,\s*B♭7\s*,\s*Unsure$/ }),
    ).toBeVisible()
    // Bar 5 carries bar 4's E♭maj7 on: named for screen readers, only slashes on the paper.
    await expect(chart.getByRole('button', { name: /^Bar 5\s*,\s*E♭maj7$/ })).toBeVisible()
    const written = [
      ...element.querySelectorAll('[data-slot=chart-chord] [data-slot=chord-symbol]'),
    ]
    await expect(written.map((c) => c.textContent)).toEqual([
      'E♭maj7',
      'A♭maj7',
      'B♭7',
      'E♭maj7',
      'A♭m7',
      'Bmaj7',
      'Fm7',
      'A♭',
    ])
    // A late chord ends at its barline rather than being clipped by it.
    for (const chord of element.querySelectorAll('[data-slot=chart-chord]')) {
      const barline = (
        chord.closest('[data-slot=bar-target]') as HTMLElement
      ).getBoundingClientRect()
      await expect(chord.getBoundingClientRect().right).toBeLessThanOrEqual(barline.right)
    }
    await expect(element.querySelectorAll('ol[data-line]')).toHaveLength(2)
    await expect(canvas.getByText(/E♭ major/)).toBeVisible()
    // The strip's keyboards: now (empty under N.C.) and the next chord's voicing (wide strips).
    await expect(await canvas.findByRole('img', { name: 'No chord' })).toBeVisible()
    // The strip fills in on its first animation frame.
    await expect(
      await canvas.findByRole('img', {
        name: 'E♭maj7: left hand E♭, right hand G B♭ D',
        hidden: true,
      }),
    ).toBeInTheDocument()
  },
}

/** Piano with a loop on bars 3–4 from the URL: those bars pressed, shaded and railed. */
export const PianoLoop: Story = {
  render: screen(PIANO_KINDS, PIANO, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    const { chart } = await pianoChart(canvasElement)
    const pressed = chart
      .getAllByRole('button')
      .filter((bar) => bar.getAttribute('aria-pressed') === 'true')
      .map((bar) => bar.getAttribute('data-bar'))
    await expect(pressed).toEqual(['2', '3'])
  },
}

/** Piano options: chords as played or as triads, the voicing and the hands. */
export const PianoOptions: Story = {
  render: screen(PIANO_KINDS, PIANO),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', { name: /^Piano options/ }, { timeout: 10_000 }),
    )
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole('dialog', { name: 'Piano options' }, { timeout: 10_000 })
    await userEvent.click(within(popup).getByRole('button', { name: 'Root position' }))
    await userEvent.click(within(popup).getByRole('button', { name: 'Right only' }))
    await expect(
      await canvas.findByRole('img', { name: 'E♭maj7: right hand G B♭ D', hidden: true }),
    ).toBeInTheDocument()
    await userEvent.click(within(popup).getByRole('button', { name: 'Simple (triads)' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: /^Piano options: Root position · Simple/ }),
      ).toBeVisible(),
    )
  },
}

export const PianoDark: Story = {
  render: screen(PIANO_KINDS, PIANO, { loop: '3-4' }),
  globals: { appearance: 'dark' },
}

export const PianoStage: Story = {
  render: screen(PIANO_KINDS, PIANO, { loop: '3-4' }),
  globals: { appearance: 'stage' },
}

const PIANO_NOTES: Patch = { ...PIANO, summary: PIANO_SUMMARY }
const PIANO_NOTES_KINDS: Kind[] = ['beats', 'stems', 'chords', 'notes.piano', 'summary']

const pianoNotes = async (canvasElement: HTMLElement) => {
  const canvas = await playable(canvasElement)
  // The roll's code loads on demand, through the chord chart's chunk.
  const region = await canvas.findByRole('region', { name: 'Notes' }, { timeout: 10_000 })
  await waitFor(() => expect(region).toBeVisible())
  return { canvas, notes: within(region), element: region }
}

/** Piano notes (21 V4): the transcribed notes fall onto a keyboard the width of the roll, hands
 * by lightness and L/R; the status bar's Chart / Notes / Staff switch, Notes by default once the notes
 * pass the quality gate; the strip keeps its chords but drops its voicing keyboards. */
export const PianoNotes: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES),
  play: async ({ canvasElement }) => {
    const { canvas, notes, element } = await pianoNotes(canvasElement)
    await expect(await notes.findByRole('img', { name: /^Falling notes/ })).toBeVisible()
    const roll = element.querySelector('[data-slot=piano-roll]') as HTMLElement
    const keys = element.querySelector('[data-slot=keyboard-diagram]') as SVGElement
    // Notes land on their keys: the roll and the keyboard share their left edge and width.
    const r = roll.getBoundingClientRect()
    const k = keys.getBoundingClientRect()
    await expect(Math.abs(r.left - k.left)).toBeLessThan(1)
    await expect(Math.abs(r.width - k.width)).toBeLessThan(1)
    await expect(r.height).toBeGreaterThan(k.height)
    await expect(notes.getByRole('img', { name: 'Nothing sounding', hidden: true })).toBeVisible()
    const strip = canvasElement.querySelector('[data-slot=piano-strip]') as HTMLElement
    await expect(strip.querySelector('[data-slot=keyboard-diagram]')).not.toBeVisible()

    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    const buttons = within(view).getAllByRole('button')
    await expect(buttons.map((b) => b.textContent)).toEqual(['Chart', 'Notes', 'Staff'])
    await expect(within(view).getByRole('button', { name: 'Notes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(within(view).getByRole('button', { name: 'Chart' }))
    const chart = await canvas.findByRole('region', { name: 'Chord chart' }, { timeout: 10_000 })
    await waitFor(() => expect(chart).toBeVisible())
    await expect(canvas.queryByRole('region', { name: 'Notes' })).toBeNull()
    await expect(strip.querySelector('[data-slot=keyboard-diagram]')).toBeVisible()
    await userEvent.click(within(view).getByRole('button', { name: 'Notes' }))
    await expect(
      await canvas.findByRole('region', { name: 'Notes' }, { timeout: 10_000 }),
    ).toBeVisible()
  },
}

/** Below the quality gate (05 recommended_view chords_only): the chord chart by default, with
 * "Show notes anyway" in the banner. */
export const PianoNotesBelowGate: Story = {
  render: screen(PIANO_NOTES_KINDS, { ...PIANO, summary: PIANO_SUMMARY_BELOW_GATE }),
  play: async ({ canvasElement }) => {
    const { canvas } = await pianoChart(canvasElement)
    await expect(canvas.queryByRole('region', { name: 'Notes' })).toBeNull()
    await expect(
      await canvas.findByText(m['practice.chords_only_piano'](), undefined, { timeout: 10_000 }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Show notes anyway' }))
    await pianoNotes(canvasElement)
  },
}

/** A loop over bars 3–4 shades their stretch of the roll. */
export const PianoNotesLoop: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    await pianoNotes(canvasElement)
  },
}

export const PianoNotesDark: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  globals: { appearance: 'dark' },
  play: async ({ canvasElement }) => {
    await pianoNotes(canvasElement)
  },
}

export const PianoNotesStage: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await pianoNotes(canvasElement)
  },
}

const pianoStaff = async (canvasElement: HTMLElement) => {
  const { canvas } = await pianoNotes(canvasElement)
  const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
  await userEvent.click(within(view).getByRole('button', { name: 'Staff' }))
  // The staff's code and alphaTab load on demand.
  const region = await canvas.findByRole('region', { name: 'Staff' }, { timeout: 20_000 })
  await waitFor(() => expect(region).toBeVisible())
  // Bars become buttons once alphaTab has drawn the score.
  await waitFor(() => expect(region.querySelectorAll('[data-slot=bar-target]')).toHaveLength(8), {
    timeout: 20_000,
  })
  return { canvas, view, region }
}

/** Piano's Staff (21 V4): the notes on a grand staff, right hand on the treble and left on the
 * bass, spelled in E♭ under its key signature; bars named with their chords and notes, unsure
 * notes marked as on the tab; the cursor follows the audio clock; Notes goes back to the roll. */
export const PianoStaff: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES),
  play: async ({ canvasElement }) => {
    const { canvas, view, region } = await pianoStaff(canvasElement)
    await expect(within(view).getByRole('button', { name: 'Staff' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const staff = within(region)
    await expect(
      staff.getByRole('button', { name: 'Bar 1: No chord; notes G4, B♭4, E♭5, D5' }),
    ).toBeVisible()
    await expect(
      staff.getByRole('button', { name: /^Bar 3: A♭maj7, B♭7; notes A♭2, / }),
    ).toBeVisible()
    // The B♭7 half bar is unsure and the G♯m7 one probable: dashed outlines, "?" on the unsure.
    await expect(
      region.querySelectorAll('[data-slot=note-mark][data-confidence=low]'),
    ).toHaveLength(4)
    await expect(
      region.querySelectorAll('[data-slot=note-mark][data-confidence=medium]'),
    ).toHaveLength(4)

    // The cursor follows the audio clock: → twice (to bar 1, then bar 2, 2.9 s) puts it on bar 2's
    // first notes.
    const cursor = region.querySelector('[data-slot=notation-cursor]') as HTMLElement
    const start = cursor.getBoundingClientRect().left
    ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(Number(cursor.getAttribute('data-time'))).toBeCloseTo(2.9, 2))
    const bar2 = staff.getByRole('button', { name: /^Bar 2:/ }).getBoundingClientRect()
    const at = cursor.getBoundingClientRect().left
    await expect(at).toBeGreaterThan(start)
    await expect(at).toBeGreaterThanOrEqual(bar2.left)
    await expect(at).toBeLessThan(bar2.left + bar2.width / 2)

    await userEvent.click(within(view).getByRole('button', { name: 'Notes' }))
    const roll = await canvas.findByRole('region', { name: 'Notes' }, { timeout: 10_000 })
    await waitFor(() => expect(roll).toBeVisible())
    await expect(canvas.queryByRole('region', { name: 'Staff' })).toBeNull()
  },
}

/** A loop over bars 3–4: those staff bars pressed, shaded and railed, A and B at its ends. */
export const PianoStaffLoop: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    const { region } = await pianoStaff(canvasElement)
    const pressed = [...region.querySelectorAll('[data-slot=bar-target][aria-pressed=true]')].map(
      (bar) => bar.getAttribute('data-bar'),
    )
    await expect(pressed).toEqual(['2', '3'])
    await waitFor(() => expect(region.querySelectorAll('[data-slot=loop-rail]')).toHaveLength(2))
  },
}

/** Below the quality gate: Staff, like Notes, shows the transcription anyway. */
export const PianoStaffBelowGate: Story = {
  render: screen(PIANO_NOTES_KINDS, { ...PIANO, summary: PIANO_SUMMARY_BELOW_GATE }),
  play: async ({ canvasElement }) => {
    const { canvas } = await pianoChart(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Staff' }))
    const region = await canvas.findByRole('region', { name: 'Staff' }, { timeout: 20_000 })
    await waitFor(() => expect(region).toBeVisible())
    await expect(canvas.queryByText(m['practice.chords_only_piano']())).toBeNull()
  },
}

export const PianoStaffDark: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  globals: { appearance: 'dark' },
  play: async ({ canvasElement }) => {
    await pianoStaff(canvasElement)
  },
}

export const PianoStaffStage: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await pianoStaff(canvasElement)
  },
}

/** Piano on a phone (glance view): the current chord, its voicing on a keyboard, the next chord. */
export const PianoGlance: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(PIANO_KINDS, PIANO)}>
      <PracticeProvider songId={SONG_ID} search={{}} fetchAudio={tone}>
        <div data-density="practice" className="flex h-[40rem] flex-col">
          <GlanceView />
        </div>
      </PracticeProvider>
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('region', { name: 'Current chord' })).toBeVisible()
    await expect(await canvas.findByRole('img', { name: 'No chord' })).toBeVisible()
  },
}

// The status bar's and transport's popovers (27 §3.7.4): each opens from its own control.
const opens =
  (control: RegExp, expectText: string | RegExp): NonNullable<Story['play']> =>
  async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: control }))
    const body = within(canvasElement.ownerDocument.body)
    // Popover contents load on first open.
    const popup = await body.findByRole('dialog', undefined, { timeout: 10_000 })
    const shown = (await within(popup).findAllByText(expectText))[0]
    // Popups fade in (26 §10).
    await waitFor(() => expect(shown).toBeVisible())
  }

/** ⚙ Display: appearance, score, distance and calibration, font, uncertainty (27 §3.7.4). */
export const DisplayPopover: Story = {
  render: screen(ALL),
  play: opens(/^Display$/, m['nav.appearance']()),
}

/** The transcription chip in the status bar: the legend and the "Show uncertainty" switch. */
export const LegendChip: Story = {
  render: screen(ALL),
  play: opens(/^Auto-transcribed · v/, /^Auto-transcribed — may contain errors/),
}

/** Level and capo from the chord strip's end (12 §2). */
export const LevelAndCapo: Story = {
  render: screen(ALL),
  play: opens(/^Level and capo: As played/, m['practice.level_and_capo']()),
}

/** The loop's options from the transport's badge: from/to bars, clear, saved clips (12 §5). */
export const LoopOptions: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  play: opens(/^Loop · bars 5–6/, m['practice.loop_options']()),
}

/** Speed panel from the readout: slider and presets (27 §3.7.4). */
export const SpeedPanel: Story = {
  render: screen(ALL),
  play: opens(/^Speed:/, /^70\s%$/),
}

/** ⋯ More: shortcuts, editor on desktop, key bindings. */
export const MorePanel: Story = {
  render: screen(ALL),
  play: opens(/^More$/, m['practice.shortcuts']()),
}

/** `?` on desktop: the shortcuts overlay. */
export const ShortcutsOverlay: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    await userEvent.keyboard('?')
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole('dialog', undefined, { timeout: 10_000 })
    await waitFor(() => expect(dialog).toBeVisible())
  },
}

/** Desktop editor (27 §3.8): notation and the inspector. */
export const Edit: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/edit`} seed={seed(ALL)}>
      <EditPage songId={SONG_ID} fetchAudio={tone} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
  },
}
