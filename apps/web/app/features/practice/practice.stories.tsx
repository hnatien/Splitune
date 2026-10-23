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
import { ALL, type Kind, type Patch, SONG_ID, seed, tone } from './practice-story-data'

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

/** + beats: bar numbers, bar-snapped loops, count-in available. */
export const BeatsFound: Story = {
  render: screen(['beats'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByRole('list', { name: 'Bars' })).toBeVisible()
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
    await expect(
      await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 }),
    ).toBeVisible()
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
