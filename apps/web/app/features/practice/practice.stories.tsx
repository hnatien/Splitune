import chords from '@splitune/contracts/fixtures/chords.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { AppStory } from '../../../.storybook/app.tsx'
import { EditPage } from './edit-page'
import { GlanceView } from './glance-view'
import { useKeys } from './keys-store'
import { PracticeProvider, type PracticeSearch } from './practice-context'
import { PracticeLoading } from './practice-loading'
import { PracticePage } from './practice-page'
import { usePracticeUi } from './practice-store'
import {
  ALL,
  ALL_BASS,
  BASS_LINE,
  DRUM_NOTES_SWING,
  DRUM_STEMS,
  DRUM_SUMMARY,
  DRUM_SUMMARY_BELOW_GATE,
  GUITAR_SHIFTS,
  GUITAR_STRUMS,
  type Kind,
  type Patch,
  PIANO_CHORDS,
  PIANO_SUMMARY,
  PIANO_SUMMARY_BELOW_GATE,
  SONG_ID,
  seed,
  tone,
  VOCAL_LINE,
  VOCAL_STEMS,
  VOCAL_SUMMARY,
} from './practice-story-data'

// The practice screen (27 §3.7) on the contracts' 8-bar Am–F–C–G fixture: the desktop regions at
// 1200 px (the story runner's default) and at 1440 / 1180 / below 1180 / below 1024 (Main.dc.html),
// the inspector's tabs, the progressive states as artefacts land (§3.7.3), failures, follow modes,
// playhead styles, reduced motion, the keymap, the chords-only fallback, Daylight and Stage, the
// tablet and phone arrangements and every instrument's views. Audio is a generated tone; nothing
// reaches the network.
const VIEWPORTS = {
  desktop1440: {
    name: 'Desktop 1440',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  desktop1180: {
    name: 'Desktop 1180',
    styles: { width: '1180px', height: '820px' },
    type: 'desktop',
  },
  desktop1100: {
    name: 'Desktop 1100',
    styles: { width: '1100px', height: '820px' },
    type: 'desktop',
  },
  desktop1000: {
    name: 'Desktop 1000',
    styles: { width: '1000px', height: '760px' },
    type: 'desktop',
  },
}
const meta = {
  title: 'Screens/Practice',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
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

/** Local audio only (27 §3.7.3): Getting ready over a faint staff, the stages with what each
 * leaves, What works now, and the analysing badge in the top bar. */
export const Analysing: Story = {
  render: screen([], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const card = await canvas.findByRole('region', { name: m['practice.getting_ready']() })
    await expect(card).toBeVisible()
    await expect(within(card).getByRole('progressbar')).toBeVisible()
    await expect(canvas.getByRole('region', { name: m['practice.what_works_now']() })).toBeVisible()
    await expect(await canvas.findByText(/^Analysing 4 of 8/)).toBeVisible()
    // The mix pill says why it waits (27 §3.7.1).
    await expect(canvas.getByRole('button', { name: /^Mix/ })).toBeDisabled()
  },
}

/** + beats: bar loops, count-in and the click work on the original; the card says so. */
export const BeatsFound: Story = {
  render: screen(['beats'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['practice.practise_already_beats']())).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Count-in' })).toBeEnabled()
  },
}

/** After tagging and before separation: "We hear guitar, bass, drums and vocals." with the part
 * question, Yes, guitar and Pick another (27 §3.7.3). */
export const PartQuestion: Story = {
  beforeEach: () => localStorage.removeItem('splitune.part-confirmed'),
  render: screen(['beats'], { running: true, heard: ['guitar', 'bass', 'drums', 'vocals'] }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByText('We hear guitar, bass, drums and vocals.', undefined, {
        timeout: 10_000,
      }),
    ).toBeVisible()
    await expect(canvas.getByText('Is guitar the part you play?')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Pick another' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Yes, guitar' }))
    await expect(canvas.queryByText('Is guitar the part you play?')).toBeNull()
  },
}

/** The processing machine is offline: said once, with what happens next, never a stalled bar. */
export const WorkerOffline: Story = {
  render: screen(['beats'], { workerOffline: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['analysis.queued_offline']())).toBeVisible()
  },
}

/** A failed analysis: the failure card with Try again (27 §3.11). */
export const AnalysisFailed: Story = {
  render: screen([], { analysisFailed: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = await canvas.findByRole('alert', undefined, { timeout: 20_000 })
    await expect(within(card).getByText(m['analysis.failed']())).toBeVisible()
    await expect(within(card).getByRole('button', { name: m['common.try_again']() })).toBeVisible()
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
    await expect(await canvas.findByRole('button', { name: /^Mix/ })).toBeVisible()
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

/** Master volume on the transport: the fader by keyboard, mute, and unmute back to that level. */
export const Volume: Story = {
  render: screen(ALL),
  // From 1280 px the dock has room for the fader (26 §7).
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const group = canvas.getByRole('group', { name: 'Volume' })
    const fader = within(group).getByRole('slider', { name: 'Volume' })
    fader.focus()
    await userEvent.keyboard('{PageDown}')
    await expect(fader).toHaveAttribute('aria-valuenow', '90')
    const mute = within(group).getByRole('button', { name: 'Mute' })
    await userEvent.click(mute)
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expect(fader).toHaveAttribute('aria-valuenow', '0')
    await userEvent.click(mute)
    await expect(fader).toHaveAttribute('aria-valuenow', '90')
    // The level is stored per device: leave the next story at full volume.
    fader.focus()
    await userEvent.keyboard('{End}')
    await expect(fader).toHaveAttribute('aria-valuenow', '100')
  },
}

/** A loop on bars 5–6 from the URL (`?loop=5-6`): the wash beneath the looped bars, the bracket
 * with its badge on the score, the band on the song map, the loop pill. */
const loopActive: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = await playable(canvasElement)
  // Every layout: the transport's pill (the glance view repeats it on phones).
  await expect((await canvas.findAllByText(/Loop · bars 5–6/))[0]).toBeVisible()
  await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
  // One bracket over the looped bars of their system, its badge on the first — not a rule round
  // each bar; the washes sit beneath the score.
  await waitFor(() =>
    expect(canvasElement.querySelectorAll('[data-slot=loop-bracket]')).toHaveLength(1),
  )
  await expect(canvasElement.querySelector('[data-slot=loop-badge]')).toHaveTextContent(
    'Loop · bars 5–6',
  )
  const shade = canvasElement.querySelector<HTMLElement>('[data-slot=loop-shade]')
  await expect(shade && getComputedStyle(shade).borderTopWidth).toBe('0px')
}

export const LoopActive: Story = { render: screen(ALL, {}, { loop: '5-6' }), play: loopActive }

/** Main.dc.html at 1440: all five regions. */
export const LoopActiveWide: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1440' } },
  play: loopActive,
}

/** At 1180 the inspector is still docked (27 §3.7.1). */
export const LoopActive1180: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1180' } },
  play: async (context) => {
    await loopActive(context)
    await expect(
      within(context.canvasElement).getByRole('complementary', { name: 'Practice tools' }),
    ).toBeVisible()
  },
}

export const LoopActiveDaylight: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: loopActive,
}

export const LoopActiveStage: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { appearance: 'stage', viewport: { value: 'desktop1440' } },
  play: loopActive,
}

/** Below 1180 the inspector is a drawer that "Tools" opens, above the dock (27 §3.7.1). */
export const InspectorDrawer: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1100' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(canvas.queryByRole('complementary', { name: 'Practice tools' })).toBeNull()
    await userEvent.click(await canvas.findByRole('button', { name: 'Tools' }))
    const body = within(canvasElement.ownerDocument.body)
    const drawer = await body.findByRole('dialog', { name: 'Practice tools' }, { timeout: 10_000 })
    await waitFor(() => expect(drawer).toBeVisible())
    // It never covers the dock (2.4.11).
    const dock = canvas.getByRole('toolbar', { name: 'Playback' }).getBoundingClientRect()
    await expect(drawer.getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.top + 1)
  },
}

/** Below 1024 the Now column is a strip above the notation (27 §3.7.1). */
export const NowStrip: Story = {
  render: screen(ALL),
  globals: { viewport: { value: 'desktop1000' } },
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot=now-strip]')).toBeInTheDocument(),
    )
    await expect(canvasElement.querySelector('[data-slot=now-column]')).toBeNull()
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

/** A URL import's video: closed by default, a floating player opened from ⋯ that grows, shrinks
 * and closes (27 §3.7.2). */
export const WithVideo: Story = {
  render: screen(ALL, { video: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const pane = () => canvasElement.querySelector<HTMLElement>('[data-slot=video-pane]')
    await expect(pane()).toBeNull()
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await canvas.findByRole('button', { name: 'More' }))
    await userEvent.click(await body.findByRole('button', { name: 'Video' }, { timeout: 10_000 }))
    await userEvent.keyboard('{Escape}')
    // The player's code loads on first open.
    await waitFor(() => expect(pane()).toBeVisible(), { timeout: 10_000 })
    const small = pane()?.getBoundingClientRect().width ?? 0
    await userEvent.click(canvas.getByRole('button', { name: 'Larger video' }))
    await waitFor(() => expect(pane()?.getBoundingClientRect().width ?? 0).toBeGreaterThan(small))
    await userEvent.click(canvas.getByRole('button', { name: 'Hide video' }))
    await waitFor(() => expect(pane()).toBeNull())
  },
}

export const ReadyDaylight: Story = { render: screen(ALL), globals: { appearance: 'light' } }

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
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }))
    await expect(canvas.queryByText(m['practice.screen_tip']())).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }))
  },
}

/** Storage blocked (privacy modes): Close still closes the tip on this page. */
export const ScreenMayLockNoStorage: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true })
    localStorage.removeItem('splitune.screen-tip')
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    return () => {
      Storage.prototype.setItem = setItem
      Reflect.deleteProperty(navigator, 'wakeLock')
    }
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }))
    await canvas.findByText(m['practice.screen_tip'](), undefined, { timeout: 10_000 })
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }))
    await expect(canvas.queryByText(m['practice.screen_tip']())).toBeNull()
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

/** A stored `stage` (26 §2): Night Rehearsal at no less than Music-stand sizes, × 1.25. */
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

/** Many chords: the Now column shows the next one large and up to five "Then" chips, which wrap
 * inside the column (27 §3.7.1). */
export const ManyChords: Story = {
  render: screen(ALL, { chords: MANY_CHORDS }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const column = await canvas.findByRole('complementary', { name: 'Current chord' })
    const list = await within(column).findByRole('list', { name: 'Chords' })
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(5))
    // No chip paints past the column's own edge.
    const edge = column.getBoundingClientRect().right
    for (const chip of within(list).getAllByRole('button')) {
      await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(edge)
    }
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

/** Choosing Chords after "Show tab anyway" takes it back: the banner returns, and the chords are
 * what the song saves for next time. */
export const ChordsTakesBackShowTab: Story = {
  render: screen(ALL, { summary: CHORDS_ONLY }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show tab anyway' }))
    await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
    await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
    const show = await canvas.findByRole('button', { name: 'Show tab anyway' })
    // Banners fade in (26 §10).
    await waitFor(() => expect(show).toBeVisible())
  },
}

/** Resume (13 §5): the song opens on the Chords the learner chose last time. */
export const ResumeOnChords: Story = {
  render: screen(ALL, { savedView: 'chords_only' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
    await waitFor(() => expect(sheet).toBeVisible())
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await expect(within(view).getByRole('button', { name: 'Chords' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

/** Resume: "Show tab anyway" was saved, so a chords-only song opens on its tab, no banner. */
export const ResumeShowTabAnyway: Story = {
  render: screen(ALL, { summary: CHORDS_ONLY, savedView: 'tab' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await waitFor(() => expect(tab).toBeVisible())
    await expect(canvas.queryByRole('button', { name: 'Show tab anyway' })).toBeNull()
  },
}

// A coarse-pointer layout as its feature queries report it (26 §7): the story runner has no touch
// emulation, so the queries are answered as that device would. Tablet landscape by default.
const coarse = (answers: Record<string, boolean> = {}) => {
  const matchMedia = window.matchMedia
  const device: Record<string, boolean> = {
    '(pointer: coarse)': true,
    '(max-width: 640px)': false,
    '(max-height: 640px)': false,
    '(orientation: landscape)': true,
    ...answers,
  }
  window.matchMedia = (query) => {
    const matches = device[query]
    if (matches === undefined) return matchMedia.call(window, query)
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }
  }
  return () => {
    window.matchMedia = matchMedia
  }
}

/** A tab without chords on a phone: phones leave the level out, so no strip is left over the tab
 * (on larger screens the strip holds the level). */
export const TabWithoutChordsPhone: Story = {
  beforeEach: () => coarse({ '(max-height: 640px)': true }),
  render: screen(['beats', 'stems', 'notes.guitar', 'tab.guitar', 'summary']),
  globals: { viewport: { value: 'mobile2', isRotated: true } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await waitFor(() => expect(tab).toBeVisible())
    await expect(canvasElement.querySelector('[data-slot=chord-strip]')).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^Level/ })).toBeNull()
  },
}

/** Tap a "Then" chip: the Fix tab opens on its bar with the alternatives as frequencies (27 §3.7.4;
 * Fix mode itself is s38's). */
export const Editor: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const column = await canvas.findByRole('complementary', { name: 'Current chord' })
    const chips = await within(column).findByRole('list', { name: 'Chords' })
    await userEvent.click(within(chips).getAllByRole('button')[0] as HTMLElement)
    const fix = await canvas.findByRole('tab', { name: /^Fix/ })
    await waitFor(() => expect(fix).toHaveAttribute('aria-selected', 'true'))
    const panel = await canvas.findByRole('tabpanel')
    await expect(
      (await within(panel).findAllByText(/about 1 in \d+/i, undefined, { timeout: 10_000 }))[0],
    ).toBeVisible()
  },
}

/** On a tablet the editor is still the sheet (until s43). */
export const EditorTablet: Story = {
  beforeEach: () => coarse(),
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const strip = await canvas.findByRole('list', { name: 'Chords' })
    await userEvent.click(await within(strip).findByRole('button', { name: /^G/ }))
    const body = within(canvasElement.ownerDocument.body)
    const editor = await body.findByRole('dialog', { name: 'Edit this bar' }, { timeout: 10_000 })
    await expect(within(editor).getAllByText(/about 1 in \d+/i)[0]).toBeVisible()
  },
}

/** The mix pill opens the Mix tab: presets as radio cards, your part and the Band (27 §3.7.4). */
export const Mixer: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Mix/ }))
    const panel = await canvas.findByRole('tabpanel')
    await expect(
      await within(panel).findByRole('radiogroup', { name: 'Mix' }, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(
      within(panel).getByText('Your part', { selector: '[data-slot=badge]' }),
    ).toBeVisible()
    await expect(within(panel).getByText('Band')).toBeVisible()
    await userEvent.click(within(panel).getByRole('radio', { name: /^Minus-one/ }))
    await expect(within(panel).getByRole('radio', { name: /^Minus-one/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  },
}

/** The mixer on a tablet: the Mix tab's body in the drawer. */
export const MixerTablet: Story = {
  beforeEach: () => coarse(),
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Mix' }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByRole('dialog', { name: 'Mix' }, { timeout: 10_000 }),
    ).toBeVisible()
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
  // The strip's keyboards show once it's wide enough (beside the docked inspector).
  globals: { viewport: { value: 'desktop1440' } },
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

/** Piano while its notes are still being transcribed: the analysis status holds the paper and
 * nothing plays yet, though the beat, stems and chords are in; it all opens with the notes. */
export const PianoAwaitingNotes: Story = {
  render: screen(
    PIANO_KINDS.filter((kind) => kind !== 'summary'),
    { ...PIANO, running: true },
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(m['practice.placeholder_piano'](), undefined, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(canvas.getByRole('progressbar')).toBeVisible()
    await expect(canvas.queryByText(m['practice.practise_already_beats']())).toBeNull()
    await expect(canvas.queryByRole('region', { name: 'Chord chart' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Count-in' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: /^Mix/ })).toBeDisabled()
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
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', { name: /^Piano options/ }, { timeout: 10_000 }),
    )
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole('dialog', { name: 'Piano options' }, { timeout: 10_000 })
    // Piano's levels in its profile's order, simplest first like every instrument's.
    const level = within(popup).getByRole('group', { name: m['practice.chords_level']() })
    await expect(
      within(level)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Simple (triads)', 'As played'])
    await userEvent.click(within(popup).getByRole('button', { name: 'Root position' }))
    await userEvent.click(within(popup).getByRole('button', { name: 'Right' }))
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

export const PianoDaylight: Story = {
  render: screen(PIANO_KINDS, PIANO, { loop: '3-4' }),
  globals: { appearance: 'light' },
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
    // It fades in (26 §10).
    const region = await canvas.findByRole('region', { name: 'Notes' }, { timeout: 10_000 })
    await waitFor(() => expect(region).toBeVisible())
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

/** Piano notes without chords: no chords to show, so the strip holds only Piano options, and only
 * the hands they show (the voicing and the chords' level need chords). */
export const PianoNotesWithoutChords: Story = {
  // Hands are a device default, which the Piano options story changes.
  beforeEach: () => usePracticeDefaults.getState().update({ pianoHands: 'both' }),
  render: screen(['beats', 'stems', 'notes.piano', 'summary'], PIANO_NOTES),
  play: async ({ canvasElement }) => {
    const { canvas } = await pianoNotes(canvasElement)
    await userEvent.click(
      await canvas.findByRole(
        'button',
        { name: 'Piano options: Show hands: Both' },
        { timeout: 10_000 },
      ),
    )
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole('dialog', { name: 'Piano options' }, { timeout: 10_000 })
    await expect(within(popup).queryByRole('button', { name: 'Root position' })).toBeNull()
    await expect(within(popup).queryByRole('button', { name: 'Simple (triads)' })).toBeNull()
    await userEvent.click(within(popup).getByRole('button', { name: 'Right' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Piano options: Show hands: Right' }),
      ).toBeVisible(),
    )
  },
}

/** A loop over bars 3–4 shades their stretch of the roll. */
export const PianoNotesLoop: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    await pianoNotes(canvasElement)
  },
}

export const PianoNotesDaylight: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  globals: { appearance: 'light' },
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
    await waitFor(() => expect(region.querySelectorAll('[data-slot=loop-bracket]')).toHaveLength(1))
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

export const PianoStaffDaylight: Story = {
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES, { loop: '3-4' }),
  globals: { appearance: 'light' },
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

/** Aa Display and reading: appearance (three choices), distance and reading size, font,
 * uncertainty, notation follows the music, playhead, reduce motion (27 §3.7.4). */
export const DisplayPopover: Story = {
  render: screen(ALL),
  play: opens(/^Display and reading$/, m['practice.follow']()),
}

/** The legend chip in the top bar: "Auto-transcribed · n unsure", the key, how often notes are
 * unsure in words, and the "Show uncertainty" switch (26 §5). */
export const LegendChip: Story = {
  render: screen(ALL),
  play: opens(/^Auto-transcribed/, /^Auto-transcribed — may contain errors/),
}

/** Level and capo from the Now column's card (27 §3.7.1). */
export const LevelAndCapo: Story = {
  render: screen(ALL),
  play: opens(/^Level and capo:\s*Level\s+As played/, m['practice.level_and_capo']()),
}

/** Bass: the level popover is titled "Level" and has no capo, like the drums'. */
export const BassLevel: Story = {
  render: screen(ALL_BASS, { instrument: 'bass', notes: BASS_LINE }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Level\s+As played/ }))
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole(
      'dialog',
      { name: m['practice.level']() },
      { timeout: 10_000 },
    )
    await waitFor(() =>
      expect(within(popup).getByRole('button', { name: 'Root notes' })).toBeVisible(),
    )
    await expect(within(popup).queryByLabelText(m['practice.capo']())).toBeNull()
  },
}

/** The loop pill opens the Loop tab: bars, the quick moves, fine-tune, between repeats, clear
 * (27 §3.7.4; the ladder is s37's). */
export const LoopOptions: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Loop · bars 5–6/ }))
    const panel = await canvas.findByRole('tabpanel')
    await expect(
      await within(panel).findByRole('heading', { name: 'Bars 5–6' }, { timeout: 10_000 }),
    ).toBeVisible()
    await userEvent.click(within(panel).getByRole('button', { name: m['practice.next_phrase']() }))
    await expect(await within(panel).findByRole('heading', { name: 'Bars 7–8' })).toBeVisible()
  },
}

/** The loop's options on a tablet: the Loop tab's body in the pill's popover. */
export const LoopOptionsTablet: Story = {
  beforeEach: () => coarse(),
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

// Guitar and bass Notes (step 18b): the part on lanes in tab order, moving onto a neck that lights
// the fingers sounding now. The clock is scripted with → (a bar at a time), so what the neck shows
// is checked against the bar it should be on.
const guitarNotes = async (canvasElement: HTMLElement) => {
  const canvas = await playable(canvasElement)
  const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 20_000 })
  await userEvent.click(within(view).getByRole('button', { name: 'Notes' }))
  // The Notes code loads on demand.
  const region = await canvas.findByRole('region', { name: 'Notes' }, { timeout: 20_000 })
  await waitFor(() => expect(region).toBeVisible())
  const neck = await waitFor(
    () => {
      const svg = region.querySelector('[data-slot=fretboard-diagram]')
      expect(svg).not.toBeNull()
      return svg as SVGElement
    },
    { timeout: 10_000 },
  )
  const lanes = region.querySelector('[data-slot=guitar-roll]') as HTMLCanvasElement
  return { canvas, view, region, neck, lanes }
}

/** Steps the clock `bars` bars on (from the pickup the first → lands on bar 1) and waits for the
 * neck to describe that bar. The keys go to the page, not the view switch. */
const stepTo = async (neck: SVGElement, bars: number, label: RegExp) => {
  ;(neck.ownerDocument.activeElement as HTMLElement | null)?.blur()
  for (let i = 0; i < bars; i++) await userEvent.keyboard('{ArrowRight}')
  await waitFor(() => expect(neck.getAttribute('aria-label')).toMatch(label), { timeout: 5_000 })
}

/** Guitar's Notes (21 V4, step 18b): Tab / Notes / Chords; the lanes and the neck share their
 * rows; the neck follows the clock bar by bar; two taps on the lanes loop bars, as on the tab. */
export const GuitarNotes: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const { canvas, view, neck, lanes } = await guitarNotes(canvasElement)
    const buttons = within(view).getAllByRole('button')
    await expect(buttons.map((b) => b.textContent)).toEqual(['Tab', 'Notes', 'Chords'])
    await expect(within(view).getByRole('button', { name: 'Notes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // The canvas is hidden from screen readers; the neck says what sounds.
    await expect(lanes).toHaveAttribute('aria-hidden', 'true')
    const n = neck.getBoundingClientRect()
    const l = lanes.getBoundingClientRect()
    await expect(Math.abs(n.height - l.height)).toBeLessThan(1)
    await expect(Math.abs(n.right - l.left)).toBeLessThan(1)
    await expect(within(neck as unknown as HTMLElement).getByText('e')).toBeInTheDocument()
    // Bar 3 opens on the F chord's low F: string 6, fret 1.
    await stepTo(neck, 3, /^Bar 3: F; string 6 fret 1$/)
    await expect(neck.querySelectorAll('[data-slot=fret-now]')).toHaveLength(1)
    // The note that just landed rings once (reduced motion: never).
    await expect(neck.querySelectorAll('[data-slot=fret-ring]')).toHaveLength(1)
    // A tap on the lanes arms bar 3; a bar on, a second tap makes it a loop of bars 3–4.
    const tap = () => {
      const box = lanes.getBoundingClientRect()
      return userEvent.pointer({
        keys: '[MouseLeft]',
        target: lanes,
        coords: { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 },
      })
    }
    await tap()
    await stepTo(neck, 1, /^Bar 4: F; /)
    await tap()
    await expect((await canvas.findAllByText(/^Loop · bars 3–4/))[0]).toBeVisible()
    // Back to the tab.
    await userEvent.click(within(view).getByRole('button', { name: 'Tab' }))
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
    await expect(canvas.queryByRole('region', { name: 'Notes' })).toBeNull()
  },
}

/** A loop on bars 3–4: shaded on the lanes, its next pass drawn past its end. */
export const GuitarNotesLoop: Story = {
  render: screen(ALL, {}, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    const { canvas } = await guitarNotes(canvasElement)
    await expect((await canvas.findAllByText(/^Loop · bars 3–4/))[0]).toBeVisible()
  },
}

/** Strummed shapes: one stacked shape per strum, all its fingers lit at once. */
export const GuitarNotesChords: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS }),
  play: async ({ canvasElement }) => {
    const { neck } = await guitarNotes(canvasElement)
    // Bar 3's Fmaj7 (x x 3 2 1 0): three fingers and the open top string.
    await stepTo(
      neck,
      3,
      /^Bar 3: F; string 1 fret 0, string 2 fret 1, string 3 fret 2, string 4 fret 3$/,
    )
    await expect(neck.querySelectorAll('[data-slot=fret-now]')).toHaveLength(4)
  },
}

/** A position shift: a whole bar in open position, then a line at the 7th–12th frets. The next
 * note is off the neck's window, so a cue names its fret; on the bar the neck has moved there. */
export const GuitarNotesShift: Story = {
  render: screen(ALL, { notes: GUITAR_SHIFTS }),
  play: async ({ canvasElement }) => {
    const { neck } = await guitarNotes(canvasElement)
    await stepTo(neck, 2, /^Bar 2: Am; /)
    const cue = await waitFor(() => {
      const shift = neck.querySelector('[data-slot=fret-shift]')
      expect(shift).not.toBeNull()
      return shift as SVGElement
    })
    await expect(cue).toHaveTextContent(/^Fret \d+ →$/)
    await stepTo(neck, 1, /^Bar 3: F; string \d fret \d+$/)
    await waitFor(() => expect(neck.querySelector('[data-slot=fret-shift]')).toBeNull())
    await expect(neck.querySelectorAll('[data-slot=fret-now]')).toHaveLength(1)
  },
}

/** Unsure notes keep the tab's marks: dashed outlines, "?" on the low ones; "Show uncertainty"
 * off drops them. */
export const GuitarNotesUncertain: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS }),
  play: async ({ canvasElement }) => {
    const { canvas, lanes } = await guitarNotes(canvasElement)
    // Bar 6's second strum is probable (5 notes), bar 7's first unsure (6).
    await expect(lanes).toHaveAttribute('data-medium', '5')
    await expect(lanes).toHaveAttribute('data-low', '6')
    await userEvent.click(canvas.getByRole('button', { name: /^Auto-transcribed/ }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('switch', { name: 'Show uncertainty' }))
    await waitFor(() => expect(lanes).toHaveAttribute('data-low', '0'))
    await expect(lanes).toHaveAttribute('data-medium', '0')
  },
}

/** Left-handed (Settings → Profile): the neck is mirrored, its numbers aren't. */
export const GuitarNotesLeftHanded: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS, leftHanded: true }),
  play: async ({ canvasElement }) => {
    const { neck } = await guitarNotes(canvasElement)
    await expect(neck).toHaveAttribute('data-mirrored', 'true')
    await stepTo(neck, 3, /^Bar 3: F; /)
    // The first fret's dot sits right of the third's: the nut is on the right.
    const dots = [...neck.querySelectorAll('[data-slot=fret-now]')]
    const x = (fret: string) =>
      dots.find((d) => d.textContent === fret)?.getBoundingClientRect().left ?? 0
    await expect(x('1')).toBeGreaterThan(x('3'))
  },
}

export const GuitarNotesDaylight: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS }, { loop: '3-4' }),
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    await guitarNotes(canvasElement)
  },
}

export const GuitarNotesStage: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS }, { loop: '3-4' }),
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await guitarNotes(canvasElement)
  },
}

/** Reduced motion: the lanes turn a bar at a time and only the playhead moves; no landing ring. */
export const GuitarNotesReducedMotion: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS }),
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const { neck } = await guitarNotes(canvasElement)
    await stepTo(neck, 3, /^Bar 3: F; /)
    await expect(neck.querySelectorAll('[data-slot=fret-ring]')).toHaveLength(0)
  },
}

/** A 4-string bass: four lanes and strings named G D A E; roots and fifths. */
export const BassNotes: Story = {
  render: screen(ALL_BASS, { instrument: 'bass', notes: BASS_LINE }),
  play: async ({ canvasElement }) => {
    const { view, neck } = await guitarNotes(canvasElement)
    await expect(
      within(view)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Tab', 'Notes', 'Chords'])
    const names = [...neck.querySelectorAll('text')].slice(0, 4).map((t) => t.textContent)
    await expect(names).toEqual(['G', 'D', 'A', 'E'])
    await stepTo(neck, 3, /^Bar 3: F; string 4 fret 1$/)
  },
}

/** A capo on the 2nd fret: the tab recomputes in the Worker and the neck shows the capo at the
 * nut, frets counted from it. */
export const GuitarNotesCapo: Story = {
  render: screen(ALL, { notes: GUITAR_STRUMS }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Level and capo: Capo/ }))
    const body = within(canvasElement.ownerDocument.body)
    const up = await body.findByRole('button', { name: m['practice.capo_up']() })
    await userEvent.click(up)
    await userEvent.click(up)
    await userEvent.keyboard('{Escape}')
    const { neck } = await guitarNotes(canvasElement)
    await waitFor(() => expect(neck).toHaveAttribute('data-capo', '2'))
  },
}

const VOCALS: Patch = {
  instrument: 'vocals',
  notes: VOCAL_LINE,
  stems: VOCAL_STEMS,
  summary: VOCAL_SUMMARY,
}
const VOCAL_KINDS: Kind[] = ['beats', 'stems', 'chords', 'notes.vocals', 'summary']

const vocalMelody = async (canvasElement: HTMLElement) => {
  const canvas = await playable(canvasElement)
  // The melody's code loads on demand.
  const region = await canvas.findByRole('region', { name: 'Melody' }, { timeout: 20_000 })
  // Layers fade in (200 ms, 27 §3.7.3).
  await waitFor(() => expect(region).toBeVisible())
  const roll = region.querySelector('[data-slot=melody-roll]') as HTMLCanvasElement
  const strip = await waitFor(() => {
    const found = canvasElement.querySelector<HTMLElement>('[data-slot=phrase-strip]')
    if (!found) throw new Error('no phrase strip yet')
    return found
  })
  const text = (slot: string) => strip.querySelector(`[data-slot=${slot}]`)?.textContent ?? ''
  const hud = () => canvasElement.ownerDocument.querySelector('[data-slot=pedal-hud]')
  // Practice keys reach the page, not a focused button.
  ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
  return { canvas, region, roll, strip, text, hud }
}

/** Vocals' Melody (step 18c): Melody / Chords; the roll under the phrase strip; phrase by phrase
 * from the keyboard ([ and ]), L loops the phrase, P plays the note it starts on. */
export const VocalMelody: Story = {
  render: screen(VOCAL_KINDS, VOCALS),
  play: async ({ canvasElement }) => {
    const { canvas, region, roll, strip, text, hud } = await vocalMelody(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await expect(
      within(view)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Melody', 'Chords'])
    await expect(within(view).getByRole('button', { name: 'Melody' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // The canvas is hidden from screen readers; the picture around it says what is sung.
    await expect(roll).toHaveAttribute('aria-hidden', 'true')
    await expect(roll).toHaveAttribute('data-phrases', '4')
    await expect(within(region).getByRole('img', { name: /^Rest, / })).toBeInTheDocument()
    // The phrase strip replaces the chord strip: before the first phrase, it shows the next one.
    await expect(canvasElement.querySelector('[data-slot=chord-strip] ol')).toBeNull()
    await expect(text('phrase-now')).toBe('—')
    await expect(text('phrase-start')).toBe('E4 (5)')
    await expect(text('phrase-next')).toBe('1 · A on E4')

    // Two bars on, the first phrase's G4 is being sung.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(roll).toHaveAttribute('data-sung', '67'))
    await waitFor(() =>
      expect(
        within(region).getByRole('img', { name: 'Phrase 1, A, Bar 2: singing G4' }),
      ).toBeInTheDocument(),
    )
    await expect(text('phrase-now')).toBe('Abars 1–2')

    // The next phrase: entered a beat early, B starts on C5 (♭3 in A minor).
    await userEvent.keyboard(']')
    await waitFor(() => expect(hud()).toHaveTextContent('Phrase 2'))
    // In the rest before it, the strip points at it.
    await waitFor(() => expect(text('phrase-now')).toBe('—'))
    await expect(text('phrase-start')).toBe('C5 (♭3)')
    await expect(text('phrase-next')).toBe('2 · B on C5')
    // L loops it (its bars), P plays its first note.
    await userEvent.keyboard('l')
    await expect((await canvas.findAllByText(/^Loop · bars 3–4/))[0]).toBeVisible()
    await expect(within(strip).getByRole('button', { name: 'Loop this phrase' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.keyboard('p')
    await waitFor(() => expect(hud()).toHaveTextContent('C5'))
    // Back a phrase ("[[" types "["): the loop moves with it.
    await userEvent.keyboard('[[')
    await expect((await canvas.findAllByText(/^Loop · bars 1–2/))[0]).toBeVisible()

    // Chords, and back.
    await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
    await waitFor(() => expect(sheet).toBeVisible())
    await expect(canvasElement.querySelector('[data-slot=phrase-strip]')).toBeNull()
    await userEvent.click(within(view).getByRole('button', { name: 'Melody' }))
    await vocalMelody(canvasElement)
  },
}

/** A phrase sung again is named by the same letter: the third phrase is A′. */
export const VocalMelodyRepeat: Story = {
  render: screen(VOCAL_KINDS, VOCALS),
  play: async ({ canvasElement }) => {
    const { text, hud } = await vocalMelody(canvasElement)
    await userEvent.keyboard(']]]')
    await waitFor(() => expect(hud()).toHaveTextContent('Phrase 3'))
    await waitFor(() => expect(text('phrase-next')).toBe('3 · A′ on E4'))
  },
}

/** A loop on bars 3–4 is the second phrase's: the strip's phrase loop shows it on. */
export const VocalMelodyLoop: Story = {
  render: screen(VOCAL_KINDS, VOCALS, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    const { canvas, strip } = await vocalMelody(canvasElement)
    await expect((await canvas.findAllByText(/^Loop · bars 3–4/))[0]).toBeVisible()
    await expect(within(strip).getByRole('button', { name: 'Loop this phrase' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

/** The guide vocal: the vocal stem on, quiet or off, from the strip; M (mute part) turns it off. */
export const VocalMelodyGuide: Story = {
  render: screen(VOCAL_KINDS, VOCALS),
  // The strip shows the guide's levels once it's wide enough (beside the docked inspector).
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const { strip } = await vocalMelody(canvasElement)
    const guide = await within(strip).findByRole('group', { name: 'Guide vocal' })
    const level = (name: string) => within(guide).getByRole('button', { name })
    await waitFor(() => expect(level('On')).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(level('Quiet'))
    await expect(level('Quiet')).toHaveAttribute('aria-pressed', 'true')
    ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('m')
    await waitFor(() => expect(level('Off')).toHaveAttribute('aria-pressed', 'true'))
  },
}

/** Melody options: scale degrees instead of names, and the whole song's pitches instead of the
 * phrase's. */
export const VocalMelodyOptions: Story = {
  render: screen(VOCAL_KINDS, VOCALS),
  play: async ({ canvasElement }) => {
    const { strip, roll } = await vocalMelody(canvasElement)
    // Following the first phrases: E4–C5 with room, an octave and more.
    await waitFor(() => expect(roll).toHaveAttribute('data-window', '62-74'))
    await userEvent.click(within(strip).getByRole('button', { name: 'Melody options' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: 'Scale degrees' }))
    await waitFor(() => expect(roll).toHaveAttribute('data-labels', 'degrees'))
    await userEvent.click(body.getByRole('button', { name: 'Whole song' }))
    // The whole song, without the low-confidence octave slip.
    await waitFor(() => expect(roll).toHaveAttribute('data-window', '62-76'))
    // The options are this device's: put them back for the stories after this one.
    await userEvent.click(body.getByRole('button', { name: 'Names' }))
    await userEvent.click(body.getByRole('button', { name: 'Follow the phrase' }))
    await waitFor(() => expect(roll).toHaveAttribute('data-labels', 'names'))
    await userEvent.keyboard('{Escape}')
  },
}

/** Uncertain notes: one medium, one low (the octave slip), dashed on the roll. */
export const VocalMelodyUncertain: Story = {
  render: screen(VOCAL_KINDS, VOCALS),
  play: async ({ canvasElement }) => {
    // A device default: an earlier story may have turned it off.
    usePracticeDefaults.getState().update({ showUncertainty: true })
    const { roll } = await vocalMelody(canvasElement)
    await expect(roll).toHaveAttribute('data-medium', '1')
    await expect(roll).toHaveAttribute('data-low', '1')
  },
}

/** Below the quality gate: chords by default, "Show notes anyway" opens the melody. */
export const VocalMelodyBelowGate: Story = {
  render: screen(VOCAL_KINDS, {
    ...VOCALS,
    summary: {
      ...VOCAL_SUMMARY,
      per_instrument: VOCAL_SUMMARY.per_instrument.map((entry) => ({
        ...entry,
        recommended_view: 'chords_only',
        reasons: ['quality_gate_failed'],
      })),
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByText(m['practice.chords_only_vocals'](), undefined, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(canvas.queryByRole('region', { name: 'Melody' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Show notes anyway' }))
    await vocalMelody(canvasElement)
  },
}

/** Below the gate with no chords to fall back on: the melody and its phrases show anyway, under a
 * plain notice with no "Show notes anyway". */
export const VocalMelodyWithoutChords: Story = {
  render: screen(['beats', 'stems', 'notes.vocals', 'summary'], {
    ...VOCALS,
    summary: {
      ...VOCAL_SUMMARY,
      per_instrument: VOCAL_SUMMARY.per_instrument.map((entry) => ({
        ...entry,
        recommended_view: 'chords_only',
        reasons: ['quality_gate_failed'],
      })),
    },
  }),
  play: async ({ canvasElement }) => {
    const { canvas, strip } = await vocalMelody(canvasElement)
    await expect(strip).toBeVisible()
    await expect(
      await canvas.findByText(m['practice.notes_unsure'](), undefined, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Show notes anyway' })).toBeNull()
  },
}

export const VocalMelodyDaylight: Story = {
  render: screen(VOCAL_KINDS, VOCALS, { loop: '3-4' }),
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    await vocalMelody(canvasElement)
  },
}

export const VocalMelodyStage: Story = {
  render: screen(VOCAL_KINDS, VOCALS, { loop: '3-4' }),
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    const { strip } = await vocalMelody(canvasElement)
    // Stage keeps the options out, as for piano.
    await expect(within(strip).queryByRole('button', { name: 'Melody options' })).toBeNull()
  },
}

/** Reduced motion: the roll turns a page at a time and the pitch window jumps instead of easing. */
export const VocalMelodyReducedMotion: Story = {
  render: screen(VOCAL_KINDS, VOCALS),
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const { roll } = await vocalMelody(canvasElement)
    await waitFor(() => expect(roll).toHaveAttribute('data-window', '62-74'))
  },
}

const DRUMS: Patch = { instrument: 'drums', stems: DRUM_STEMS, summary: DRUM_SUMMARY }
const DRUM_KINDS: Kind[] = ['beats', 'stems', 'chords', 'notes.drums', 'summary']
const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const TABLET = { viewport: { value: 'tablet', isRotated: false } }

const drumGrid = async (canvasElement: HTMLElement) => {
  const canvas = await playable(canvasElement)
  // The grid's code loads on demand, through the chord sheet's chunk.
  const region = await canvas.findByRole('region', { name: 'Grid' }, { timeout: 10_000 })
  await waitFor(() => expect(region).toBeVisible())
  return { canvas, grid: within(region), element: region }
}

/** Drums (step 25): the hits in lanes on the beat grid, named down the left as on a drum staff
 * (cymbals at the top, kick at the bottom), with the key to the kit-piece letters; the status bar's
 * Grid / Staff / Chords switch, Grid by default once the hits pass the quality gate; the level
 * button names the level and has no capo. Hi-hats, toms and cymbals are kit-piece guesses: hollow
 * and dashed. */
export const Drums: Story = {
  render: screen(DRUM_KINDS, DRUMS),
  play: async ({ canvasElement }) => {
    const { canvas, grid, element } = await drumGrid(canvasElement)
    await expect(await grid.findByRole('img', { name: /^Drum grid/ })).toBeVisible()
    const lanes = grid.getByRole('list', { name: 'Drum kit, top to bottom' })
    await expect(
      within(lanes)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Cymbals', 'Hi-hat', 'Toms', 'Snare', 'Kick'])
    await expect(grid.getByText(m['practice.drum_key']())).toBeVisible()
    // The lane names sit beside the grid, which takes the rest of the width.
    const drawn = element.querySelector('[data-slot=drum-grid]') as HTMLElement
    await expect(drawn.getBoundingClientRect().left).toBeGreaterThan(
      lanes.getBoundingClientRect().right - 1,
    )

    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await expect(
      within(view)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Grid', 'Staff', 'Chords'])
    await expect(within(view).getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(canvas.getByRole('button', { name: 'Level: As played' })).toBeVisible()
  },
}

/** Drums while their hits are still being transcribed: the analysis status holds the paper and
 * nothing plays yet; it all opens with the hits. */
export const DrumsAwaitingNotes: Story = {
  render: screen(
    DRUM_KINDS.filter((kind) => kind !== 'summary' && kind !== 'notes.drums'),
    { ...DRUMS, running: true },
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(m['practice.placeholder_drums'](), undefined, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeDisabled()
  },
}

/** Below the quality gate (recommended_view chords_only): the chord sheet by default, with "Show
 * notes anyway" in the banner. */
export const DrumsBelowGate: Story = {
  render: screen(DRUM_KINDS, { ...DRUMS, summary: DRUM_SUMMARY_BELOW_GATE }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByRole('button', { name: 'Show notes anyway' }, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(canvas.queryByRole('region', { name: 'Grid' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Show notes anyway' }))
    await drumGrid(canvasElement)
  },
}

/** The levels (V13): Main groove (kick, snare, hi-hat; fills become the groove), Simplified
 * (hi-hat in eighths) and As played; the level button follows the choice. */
export const DrumsLevels: Story = {
  render: screen(DRUM_KINDS, DRUMS),
  play: async ({ canvasElement }) => {
    const { canvas } = await drumGrid(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Level: As played' }))
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole('dialog', { name: 'Level' }, { timeout: 10_000 })
    const levels = within(popup).getByRole('group', { name: 'Level' })
    await expect(
      within(levels)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Main groove', 'Simplified', 'As played'])
    await userEvent.click(within(levels).getByRole('button', { name: 'Main groove' }))
    await expect(
      await canvas.findByRole('button', { name: 'Level: Main groove' }, { timeout: 10_000 }),
    ).toBeVisible()
  },
}

/** A song that swings bars 5–6, opened at the main groove from the URL. */
export const DrumsSwing: Story = {
  render: screen(DRUM_KINDS, { ...DRUMS, notes: DRUM_NOTES_SWING }, { level: 'core_groove' }),
  play: async ({ canvasElement }) => {
    const { canvas } = await drumGrid(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Level: Main groove' })).toBeVisible()
  },
}

/** Drums' Staff: the hits on a drum staff (hands up, feet down, the flam as a grace note), bars as
 * buttons; guesses and unsure hits marked as on the tab; Grid goes back. */
export const DrumsStaff: Story = {
  render: screen(DRUM_KINDS, DRUMS),
  play: async ({ canvasElement }) => {
    const { canvas } = await drumGrid(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Staff' }))
    const region = await canvas.findByRole('region', { name: 'Staff' }, { timeout: 20_000 })
    await waitFor(() => expect(region).toBeVisible())
    await waitFor(() => expect(region.querySelectorAll('[data-slot=bar-target]')).toHaveLength(8), {
      timeout: 20_000,
    })
    await expect(
      region.querySelectorAll('[data-slot=note-mark][data-confidence=low]').length,
    ).toBeGreaterThan(0)
    await expect(
      region.querySelectorAll('[data-slot=note-mark][data-confidence=medium]').length,
    ).toBeGreaterThan(0)
    await userEvent.click(within(view).getByRole('button', { name: 'Grid' }))
    await drumGrid(canvasElement)
  },
}

export const DrumsLoop: Story = {
  render: screen(DRUM_KINDS, DRUMS, { loop: '3-4' }),
  play: async ({ canvasElement }) => {
    await drumGrid(canvasElement)
  },
}

export const DrumsDaylight: Story = {
  render: screen(DRUM_KINDS, DRUMS, { loop: '3-4' }),
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    await drumGrid(canvasElement)
  },
}

export const DrumsStage: Story = {
  render: screen(DRUM_KINDS, DRUMS, { loop: '3-4' }),
  globals: { appearance: 'stage' },
  play: async ({ canvasElement }) => {
    await drumGrid(canvasElement)
  },
}

export const DrumsIncreasedContrast: Story = {
  render: screen(DRUM_KINDS, DRUMS, { loop: '3-4' }),
  globals: { contrast: 'more' },
  play: async ({ canvasElement }) => {
    await drumGrid(canvasElement)
  },
}

/** Reduced motion: the grid turns two bars at a time and only the playhead moves. */
export const DrumsReducedMotion: Story = {
  render: screen(DRUM_KINDS, DRUMS),
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    await drumGrid(canvasElement)
  },
}

export const DrumsTablet: Story = {
  render: screen(DRUM_KINDS, DRUMS),
  globals: { ...TABLET },
  play: async ({ canvasElement }) => {
    await drumGrid(canvasElement)
  },
}

/** Phone portrait opens on the glance view; the grid is a tap away on the view switch. */
export const DrumsPhone: Story = {
  render: screen(DRUM_KINDS, DRUMS),
  globals: { ...PHONE },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Grid' }))
    await drumGrid(canvasElement)
  },
}

// --- s35: the inspector's tabs, the pass prompt, the keymap, follow modes and playhead styles ---

/** ?tab=mix opens the Mix tab (27 §1); the tab is remembered on this device. */
export const InspectorMix: Story = {
  render: screen(ALL, {}, { tab: 'mix' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Mix' })).toHaveAttribute('aria-selected', 'true')
    await expect(
      await within(canvas.getByRole('tabpanel')).findByRole('radiogroup', { name: 'Mix' }),
    ).toBeVisible()
  },
}

/** Mix before the stems: "The mixer opens once your part is isolated." (27 §4). */
export const InspectorMixBeforeStems: Story = {
  render: screen(['beats', 'chords'], { running: true }, { tab: 'mix' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['practice.mix_wait']())).toBeVisible()
  },
}

/** Progress until s39: its empty state (27 §4). */
export const InspectorProgress: Story = {
  render: screen(ALL, {}, { tab: 'progress' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['practice.progress_empty']())).toBeVisible()
  },
}

/** Fix with no bar chosen: how to pick one; the tab carries the unsure count. */
export const InspectorFix: Story = {
  render: screen(ALL, {}, { tab: 'fix' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['practice.fix_select']())).toBeVisible()
    await expect(canvas.getByRole('tab', { name: /^Fix/ })).toBeVisible()
  },
}

/** Loop tab with no loop yet: "No loop yet — tap two bars, or a section" (27 §4). */
export const InspectorLoopEmpty: Story = {
  render: screen(ALL, {}, { tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['practice.loop_empty']())).toBeVisible()
  },
}

/** Loop tab before the beat is found (27 §3.7.4): while Getting ready takes the width the
 * inspector waits in its drawer, opened by Tools. */
export const InspectorLoopBeforeBeats: Story = {
  render: screen([], { running: true }, { tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Tools' }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByText(m['practice.loop_needs_beats'](), undefined, { timeout: 10_000 }),
    ).toBeVisible()
  },
}

// Every control of the dock and the pass prompt at its target (26 §8, 28 §3): main practice
// controls 64 × 64, secondary 48, nothing under 44.
const atLeast = async (element: Element, size: number) => {
  const box = element.getBoundingClientRect()
  await expect(
    Math.round(box.width),
    element.getAttribute('aria-label') ?? '',
  ).toBeGreaterThanOrEqual(size)
  await expect(
    Math.round(box.height),
    element.getAttribute('aria-label') ?? '',
  ).toBeGreaterThanOrEqual(size)
}

/** The pass prompt open after pass 2 at 70 % (Main.dc.html), left open for review. */
export const PassPromptOpen: Story = {
  beforeEach: () => () => usePracticeUi.setState({ promptPass: 0 }),
  render: screen(ALL, {}, { loop: '5-6', speed: 70 }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    usePracticeUi.setState({ promptPass: 2 })
    const prompt = await canvas.findByRole('group', { name: m['practice.pass_rate']() })
    await waitFor(() =>
      expect(within(prompt).getByText(/^Pass 2 at 70\s% — how was it\?$/)).toBeVisible(),
    )
  },
}

/** The pass prompt over the notation after a pass (27 §3.7.1): "Pass 2 at 70 % — how was it?",
 * Felt clean and Not yet at 64 px; it never covers the focused control (2.4.11). */
export const PassPrompt: Story = {
  render: screen(ALL, {}, { loop: '5-6', speed: 70 }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    usePracticeUi.setState({ promptPass: 2 })
    const prompt = await canvas.findByRole('group', { name: m['practice.pass_rate']() })
    // It fades in (26 §10).
    await waitFor(() =>
      expect(within(prompt).getByText(/^Pass 2 at 70\s% — how was it\?$/)).toBeVisible(),
    )
    const clean = within(prompt).getByRole('button', { name: /^Felt clean/ })
    await atLeast(clean, 64)
    await atLeast(within(prompt).getByRole('button', { name: /^Not yet/ }), 64)
    // Focus not obscured: tab through the dock; no focused control is fully under the prompt.
    const doc = canvasElement.ownerDocument
    const dock = canvas.getByRole('toolbar', { name: 'Playback' })
    for (const control of within(dock).getAllByRole('button')) {
      control.focus()
      const box = control.getBoundingClientRect()
      const points = [
        [box.left + 2, box.top + 2],
        [box.right - 2, box.top + 2],
        [box.left + 2, box.bottom - 2],
        [box.right - 2, box.bottom - 2],
        [box.left + box.width / 2, box.top + box.height / 2],
      ]
      const visible = points.some(([x, y]) => {
        const hit = doc.elementFromPoint(x as number, y as number)
        return hit !== null && (hit === control || control.contains(hit))
      })
      await expect(visible, control.getAttribute('aria-label') ?? control.textContent ?? '').toBe(
        true,
      )
    }
    await userEvent.click(clean)
    await waitFor(() =>
      expect(canvas.queryByRole('group', { name: m['practice.pass_rate']() })).toBeNull(),
    )
  },
}

/** The dock's targets (26 §8): Restart, Play, Next bar, the loop pill, speed −/readout/+ and
 * Count-in at 64; Click, the mix pill and volume at 48 or more. */
export const DockTargets: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const dock = within(canvas.getByRole('toolbar', { name: 'Playback' }))
    for (const name of [
      /^Restart loop$/,
      /^Play$/,
      /^Next bar$/,
      /^Loop · bars 5–6/,
      /^Slower by 5/,
      /^Speed:/,
      /^Faster by 5/,
      /^Count-in$/,
    ]) {
      await atLeast(dock.getByRole('button', { name }), 64)
    }
    for (const name of [/^Metronome$/, /^Mix|^Your part loud|^Minus-one|^Original/, /^Mute$/]) {
      await atLeast(dock.getByRole('button', { name }), 48)
    }
    // The top bar's icon buttons and the inspector's tabs are secondary practice controls.
    await atLeast(canvas.getByRole('button', { name: 'Display and reading' }), 48)
    for (const tab of canvas.getAllByRole('tab')) await atLeast(tab, 48)
  },
}

/** ↑ and ↓ never change speed (12 §8): before any pedal is set up they say "Pedal detected? Set
 * it up"; , and . step 5 %, with Shift 1 %. */
export const SpeedKeys: Story = {
  beforeEach: () => {
    useKeys.setState({ learned: {}, singleKeys: true })
  },
  render: screen(ALL, {}, { speed: 70 }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const readout = () => canvas.getByRole('button', { name: /^Speed:/ })
    const hud = () => canvasElement.ownerDocument.querySelector('[data-slot=pedal-hud]')
    ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('{ArrowUp}')
    await waitFor(() => expect(hud()).toHaveTextContent('Pedal detected? Set it up'))
    await userEvent.keyboard('{ArrowDown}')
    await expect(readout()).toHaveAccessibleName(/^Speed: 70\s%/)
    await userEvent.keyboard('.')
    await waitFor(() => expect(readout()).toHaveAccessibleName(/^Speed: 75\s%/))
    await waitFor(() => expect(hud()).toHaveTextContent('Key . · Speed 75'))
    await userEvent.keyboard(',,')
    await waitFor(() => expect(readout()).toHaveAccessibleName(/^Speed: 65\s%/))
    await userEvent.keyboard('{Shift>}>{/Shift}')
    await waitFor(() => expect(readout()).toHaveAccessibleName(/^Speed: 66\s%/))
    // The readout counts to the new speed (26 §10) before its label and text agree again.
    await waitFor(() => expect(readout()).toHaveTextContent(/^66/))
  },
}

/** Single-key shortcuts off (WCAG 2.1.4): C, L, , and . are inert; Space still plays. */
export const SingleKeysOff: Story = {
  beforeEach: () => {
    useKeys.setState({ learned: {}, singleKeys: false })
    return () => useKeys.setState({ singleKeys: true })
  },
  render: screen(ALL, {}, { speed: 70 }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
    await userEvent.keyboard('..')
    await expect(canvas.getByRole('button', { name: /^Speed:/ })).toHaveAccessibleName(
      /^Speed: 70\s%/,
    )
    await userEvent.keyboard(' ')
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible())
    await userEvent.keyboard(' ')
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible())
  },
}

/** Notation follows the music: Scrolling — one line under a fixed now-line (12 §3). */
export const FollowScroll: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ notationLayout: 'scroll' })
    return () => usePracticeDefaults.getState().update({ notationLayout: 'page' })
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await expect(tab).toHaveAttribute('data-layout', 'scroll')
  },
}

/** Off: the notation stays where the learner put it (reading and fixing). */
export const FollowOff: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ notationLayout: 'off' })
    return () => usePracticeDefaults.getState().update({ notationLayout: 'page' })
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await expect(tab).toHaveAttribute('data-layout', 'off')
  },
}

/** Reduced motion (26 §10): Scrolling falls back to page turns and the playhead steps by beat. */
export const ReducedMotion: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ notationLayout: 'scroll' })
    useDisplay.getState().update({ motion: 'reduce' })
    return () => {
      usePracticeDefaults.getState().update({ notationLayout: 'page' })
      useDisplay.getState().update({ motion: 'system' })
    }
  },
  globals: { motion: 'reduce' },
  render: screen(ALL, {}, { loop: '5-6' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await expect(tab).toHaveAttribute('data-layout', 'page')
  },
}

/** Playhead style Block: a small block on the beat, for anyone who finds the line glaring. */
export const PlayheadBlock: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ playhead: 'block' })
    return () => usePracticeDefaults.getState().update({ playhead: 'line' })
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await expect(tab).toHaveAttribute('data-playhead', 'block')
  },
}

/** Playhead style Bar: only the current bar is shaded. */
export const PlayheadBar: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ playhead: 'bar' })
    return () => usePracticeDefaults.getState().update({ playhead: 'line' })
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await expect(tab).toHaveAttribute('data-playhead', 'bar')
    await expect(tab.querySelector('[data-slot=notation-cursor]')).not.toBeVisible()
  },
}

/** Show uncertainty off (26 §5): no outlines or "?" on the tab, the legend chip stays. */
export const UncertaintyOff: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ showUncertainty: false })
    return () => usePracticeDefaults.getState().update({ showUncertainty: true })
  },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await waitFor(
      () => expect(tab.querySelectorAll('[data-slot=bar-target]').length).toBeGreaterThan(0),
      { timeout: 20_000 },
    )
    await expect(tab.querySelectorAll('[data-slot=note-mark]')).toHaveLength(0)
    await expect(canvas.getByRole('button', { name: /^Auto-transcribed/ })).toBeVisible()
  },
}

/** A stored `stage` in the Display popover: Night Rehearsal is chosen and the distance it resolved
 * to; the next change stores `dark` (26 §2). */
export const DisplayFromStage: Story = {
  beforeEach: () => {
    useDisplay.setState({ appearance: 'stage' })
    return () => useDisplay.setState({ appearance: 'dark', distance: undefined })
  },
  globals: { appearance: 'stage' },
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Display and reading' }))
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole('dialog', undefined, { timeout: 10_000 })
    const night = await within(popup).findByRole('button', { name: 'Night Rehearsal' })
    await expect(night).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(popup).getByRole('button', { name: 'Floor' }))
    await waitFor(() => expect(useDisplay.getState().appearance).toBe('dark'))
  },
}

/** Piano Hands from the top bar (27 §3.7.5): Left draws the right hand at 45 %, audio unchanged. */
export const PianoHandsLeft: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ pianoHands: 'both' })
    return () => usePracticeDefaults.getState().update({ pianoHands: 'both' })
  },
  render: screen(PIANO_NOTES_KINDS, PIANO_NOTES),
  play: async ({ canvasElement }) => {
    const { canvas } = await pianoNotes(canvasElement)
    const hands = await canvas.findByRole('group', { name: m['practice.hands']() })
    await userEvent.click(within(hands).getByRole('button', { name: 'Left' }))
    await waitFor(() => expect(usePracticeDefaults.getState().pianoHands).toBe('left'))
  },
}

/** Getting ready in Daylight at 1440 (Practice-Ready.dc.html). */
export const GettingReadyDaylight: Story = {
  render: screen(['beats'], { running: true }),
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByRole('region', { name: m['practice.getting_ready']() }),
    ).toBeVisible()
  },
}

/** Getting ready at 1180 (27 §3.7.1 region behaviour, Practice-Ready.dc.html). */
export const GettingReady1180: Story = {
  render: screen(['beats'], { running: true }),
  globals: { viewport: { value: 'desktop1180' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByRole('region', { name: m['practice.getting_ready']() }),
    ).toBeVisible()
  },
}
