import chords from '@splitune/contracts/fixtures/chords.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { Toaster } from '@/ui/toast'
import { AppStory } from '../../../.storybook/app.tsx'
import { EditPage } from './edit-page'
import { GlanceView } from './glance-view'
import { useKeys } from './keys-store'
import { ACTIONS } from './model/keymap'
import { PracticeProvider, type PracticeSearch } from './practice-context'
import { PracticeError, PracticeLoading } from './practice-loading'
import { PracticePage } from './practice-page'
import { usePracticeUi } from './practice-store'
import {
  ALL,
  ALL_BASS,
  BASS_LINE,
  coarse,
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
  type StoryClip,
  seed,
  storyClip,
  storyLadder,
  tone,
  VOCAL_LINE,
  VOCAL_STEMS,
  VOCAL_SUMMARY,
} from './practice-story-data'

// The practice screen (27 §3.7) on the contracts' 8-bar Am–F–C–G fixture: the desktop regions at
// 1200 px (the story runner's default) and at 1440 / 1180 / below 1180 / below 1024 (Main.dc.html),
// the inspector's tabs, the progressive states as artefacts land (§3.7.3), failures, follow modes,
// playhead styles, reduced motion, the keymap, the chords-only fallback, Light and Stage, the
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
  tablet768: {
    name: 'Tablet 768',
    styles: { width: '768px', height: '1024px' },
    type: 'tablet',
  },
  phone375: {
    name: 'Phone 375',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
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
    const confidence = [0.92, 0.7, 0.2][i % 3] as number
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

// A phone held upright (26 §7): the story runner has no touch, so the feature queries answer as a
// 375 px phone would, at that viewport.
const phone = () => coarse({ '(max-width: 640px)': true, '(orientation: landscape)': false })
const PHONE_375 = { viewport: { value: 'phone375', isRotated: false } }
const TABLET_768 = { viewport: { value: 'tablet768', isRotated: false } }

/** The Tools button names the mix in play when it is one of the presets, and "Tools" otherwise. */
const MIXED = /^(Tools|Your part loud|Minus-one|Rhythm only|Original)$/
const toolsButton = (canvas: {
  getByRole: (role: 'toolbar', o: { name: string }) => HTMLElement
}) =>
  canvas
    .getByRole('toolbar', { name: 'Playback' })
    .querySelector('[aria-keyshortcuts=X]') as HTMLElement

/** Whether a control has a fill, measured against a quiet control beside it that has none: Play
 * is the screen's one filled control (26 §1.2). */
const isFilled = (control: HTMLElement, quiet: HTMLElement) =>
  getComputedStyle(control).backgroundColor !== getComputedStyle(quiet).backgroundColor

/** The speed readout's printed number (its name says the speed at once; the number counts). */
const shownSpeed = (readout: HTMLElement) =>
  readout.querySelector('[aria-hidden] > span') as HTMLElement

/** The tools panel (Loop · Mix · Progress · Fix): docked beside the music from 1180 px, never
 * over the transport; asserted as a frame (its tabs and where it sits), not by what a tab holds. */
const toolsFrame = async (canvasElement: HTMLElement, tab: RegExp) => {
  const canvas = within(canvasElement)
  const body = within(canvasElement.ownerDocument.body)
  const selected = await waitFor(
    () => {
      const found = body
        .getAllByRole('tab', { name: tab })
        .find((t) => t.getAttribute('aria-selected') === 'true')
      if (!found) throw new Error('no selected tab yet')
      return found
    },
    { timeout: 10_000 },
  )
  await expect(selected).toBeVisible()
  const panel = await body.findByRole('tabpanel', undefined, { timeout: 10_000 })
  await waitFor(() => expect(panel).toBeVisible())
  // The panel (docked, a drawer or a sheet) stops above the transport; Fix mode swaps the
  // transport for its own dock, which the panel never covers either.
  const frame = panel.closest('[data-slot=inspector]') as HTMLElement
  const bottom = (
    canvas.queryByRole('toolbar', { name: 'Playback' }) ??
    (canvasElement.querySelector('[data-slot=transport], [data-slot=fix-dock]') as HTMLElement)
  )?.getBoundingClientRect().top
  if (bottom !== undefined) {
    await waitFor(() =>
      expect(frame.getBoundingClientRect().bottom).toBeLessThanOrEqual(bottom + 1),
    )
  }
  return panel
}

/**
 * The music leads (26 §1.2, s47 direction §2): the notation takes at least `share` of the
 * viewport's height, and the transport keeps every control whole, side by side, inside its own
 * edge and the viewport, and at least 44 px each way.
 */
const layoutHolds = async (canvasElement: HTMLElement, share: number | null) => {
  const canvas = await playable(canvasElement)
  const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
  await waitFor(() => expect(tab).toBeVisible())
  const view = canvasElement.ownerDocument.defaultView as Window
  if (share !== null) {
    const notation = canvasElement.querySelector('[data-slot=notation]') as HTMLElement
    await waitFor(() =>
      expect(notation.getBoundingClientRect().height / view.innerHeight).toBeGreaterThanOrEqual(
        share,
      ),
    )
  }
  const transport = canvas.getByRole('toolbar', { name: 'Playback' })
  await expect(transport.scrollWidth).toBeLessThanOrEqual(transport.clientWidth)
  const edge = transport.getBoundingClientRect()
  const controls = [...transport.querySelectorAll<HTMLElement>('button, [role=slider]')]
    .filter((control) => control.offsetParent !== null)
    .map((control) => ({
      name: control.getAttribute('aria-label') ?? control.textContent ?? '',
      box: control.getBoundingClientRect(),
    }))
  await expect(controls.length).toBeGreaterThan(4)
  for (const { name, box } of controls) {
    await expect(Math.round(box.width), name).toBeGreaterThanOrEqual(44)
    await expect(Math.round(box.height), name).toBeGreaterThanOrEqual(44)
    await expect(box.left, name).toBeGreaterThanOrEqual(edge.left - 0.5)
    await expect(box.right, name).toBeLessThanOrEqual(Math.min(edge.right, view.innerWidth) + 0.5)
  }
  for (const [i, a] of controls.entries()) {
    for (const b of controls.slice(i + 1)) {
      const overlap =
        Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 &&
        Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1
      await expect(overlap, `${a.name} / ${b.name}`).toBe(false)
    }
  }
}

/** A ready song at 1440 × 900: the notation takes at least 70 % of the height; the transport
 * fits, every control at least 44 px. */
export const LayoutDesktop: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1440' } },
  play: ({ canvasElement }) => layoutHolds(canvasElement, 0.7),
}

export const LayoutDesktopDaylight: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: ({ canvasElement }) => layoutHolds(canvasElement, 0.7),
}

/** A ready song on a 375 × 812 phone: the tab at two bars a line takes at least 55 % of the
 * height; the status row and two transport rows fit with nothing overlapping. */
export const LayoutPhone: Story = {
  beforeEach: phone,
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { ...PHONE_375 },
  play: ({ canvasElement }) => layoutHolds(canvasElement, 0.55),
}

export const LayoutPhoneDaylight: Story = {
  beforeEach: phone,
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { appearance: 'light', ...PHONE_375 },
  play: ({ canvasElement }) => layoutHolds(canvasElement, 0.55),
}

/** An upright 768 px tablet: the one-row transport still fits with 44 px targets. */
export const LayoutTablet: Story = {
  beforeEach: () => coarse({ '(orientation: landscape)': false }),
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { ...TABLET_768 },
  play: ({ canvasElement }) => layoutHolds(canvasElement, null),
}

/** Loading (27 §4): the screen's own regions as skeletons (the song map, the paper with its
 * staff lines, the key row and the transport), so nothing moves when the song arrives; "Loading
 * your song…" after 1 s. */
export const Loading: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`}>
      <PracticeLoading slowText={m['practice.loading']()} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement()
    for (const slot of ['loading-map', 'loading-paper', 'loading-transport']) {
      await expect(canvasElement.querySelector(`[data-slot=${slot}]`)).toBeVisible()
    }
    // The transport's skeleton stands where the transport will: at the bottom edge, 80 px.
    const transport = canvasElement.querySelector('[data-slot=loading-transport]') as HTMLElement
    const view = canvasElement.ownerDocument.defaultView as Window
    await expect(Math.round(transport.getBoundingClientRect().bottom)).toBe(view.innerHeight)
    await expect(Math.round(transport.getBoundingClientRect().height)).toBe(80)
    await expect(
      await canvas.findByText('Loading your song…', undefined, { timeout: 3_000 }),
    ).toBeVisible()
  },
}

/** Loading on a phone: the status row over two rows of controls, as the transport will be. */
export const LoadingPhone: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`}>
      <PracticeLoading slowText={m['practice.loading']()} />
    </AppStory>
  ),
  globals: { appearance: 'light', ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const transport = canvasElement.querySelector('[data-slot=loading-transport]') as HTMLElement
    await expect(transport.getBoundingClientRect().height).toBeGreaterThan(100)
    await expect(
      await within(canvasElement).findByText('Loading your song…', undefined, { timeout: 3_000 }),
    ).toBeVisible()
  },
}

/** The song couldn't be fetched (27 §5.4): what happened, that it is usually the connection,
 * Try again and the way back, inside the focus shell. */
export const LoadFailed: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`}>
      <PracticePage songId={SONG_ID} search={{}} fetchAudio={tone} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const error = await canvas.findByRole('alert', undefined, { timeout: 20_000 })
    await expect(within(error).getByText(m['practice.load_failed']())).toBeVisible()
    await expect(within(error).getByText(m['practice.load_failed_hint']())).toBeVisible()
    await expect(within(error).getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(within(error).getByRole('link', { name: 'Back to the library' })).toBeVisible()
  },
}

export const LoadFailedPhone: Story = {
  ...LoadFailed,
  globals: { appearance: 'light', ...PHONE_375 },
}

/** The song is gone: no Try again (it can't help), the way back to the library. */
export const SongGone: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`}>
      <PracticeError
        title={m['error.not_found']()}
        retryLabel={m['common.try_again']()}
        backLabel={m['practice.back_to_library']()}
      />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const error = canvas.getByRole('alert')
    await expect(within(error).queryByRole('button', { name: 'Try again' })).toBeNull()
    await expect(within(error).getByRole('link', { name: 'Back to the library' })).toBeVisible()
  },
}

/** Local audio only (27 §3.7.3): Getting ready over a faint staff, the stages with what each
 * leaves, What works now as hairline rows whose state is a glyph and a word, and the analysing
 * status in the top bar. No card: the status sits on the paper. */
export const Analysing: Story = {
  render: screen([], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const ready = await canvas.findByRole('region', { name: m['practice.getting_ready']() })
    await expect(ready).toBeVisible()
    await expect(within(ready).getByRole('progressbar')).toBeVisible()
    await expect(getComputedStyle(ready).borderTopWidth).toBe('0px')
    const works = canvas.getByRole('region', { name: m['practice.what_works_now']() })
    const rows = within(works).getAllByRole('listitem')
    await expect(rows.length).toBeGreaterThan(2)
    for (const row of rows) {
      await expect(row.querySelector('[data-slot=status] svg')).not.toBeNull()
    }
    await expect(await canvas.findByText(/^Analysing 4 of 8/)).toBeVisible()
    // Before the stems the Tools button says Tools, not a mix.
    await expect(toolsButton(canvas)).toHaveAccessibleName('Tools')
  },
}

export const AnalysingDaylight: Story = {
  ...Analysing,
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
}

/** Getting ready on a phone: the stages and What works now stack in the paper, and the analysing
 * status in the top bar stays clear of the back link. */
export const AnalysingPhone: Story = {
  beforeEach: phone,
  render: screen([], { running: true }),
  globals: { ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByRole('region', { name: m['practice.getting_ready']() }),
    ).toBeVisible()
    const status = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('[data-slot=analysing]')
      if (!found) throw new Error('no analysing status yet')
      return found
    })
    const back = (
      canvas.getAllByRole('link', { name: /library/i })[0] as HTMLElement
    ).getBoundingClientRect()
    await expect(status.getBoundingClientRect().left).toBeGreaterThanOrEqual(back.right)
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
    const question = canvas.getByRole('region', { name: 'Is guitar the part you play?' })
    await expect(question).toBeVisible()
    // The one decision comes before the stages, and its answer is not a second filled control.
    const stages = canvas.getByRole('region', { name: m['practice.getting_ready']() })
    await expect(
      question.compareDocumentPosition(stages) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const yes = canvas.getByRole('button', { name: 'Yes, guitar' })
    await expect(isFilled(yes, canvas.getByRole('button', { name: 'Pick another' }))).toBe(false)
    await expect(canvas.getByRole('button', { name: 'Pick another' })).toBeVisible()
    await userEvent.click(yes)
    await expect(canvas.queryByText('Is guitar the part you play?')).toBeNull()
  },
}

/** The part question on a phone, where the chords are in and the glance view shows: the
 * question still reaches the learner, above the current chord. */
export const PartQuestionPhone: Story = {
  beforeEach: () => {
    localStorage.removeItem('splitune.part-confirmed')
    return phone()
  },
  render: screen(['beats', 'chords'], {
    running: true,
    heard: ['guitar', 'bass', 'drums', 'vocals'],
  }),
  globals: { ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const glance = await canvas.findByRole('region', { name: 'Current chord' })
    const question = await within(glance).findByRole(
      'region',
      { name: 'Is guitar the part you play?' },
      { timeout: 10_000 },
    )
    await expect(question).toBeVisible()
    await expect(within(question).getByRole('button', { name: 'Yes, guitar' })).toBeVisible()
  },
}

export const PartQuestionDaylight: Story = {
  ...PartQuestion,
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByRole(
        'region',
        { name: 'Is guitar the part you play?' },
        { timeout: 10_000 },
      ),
    ).toBeVisible()
  },
}

/** The processing machine is offline: said once, with what happens next, never a stalled bar and
 * never a time it can't keep. */
export const WorkerOffline: Story = {
  render: screen(['beats'], { workerOffline: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByText(m['analysis.queued_offline']())).toBeVisible()
    await expect(canvas.queryByText(/min left/)).toBeNull()
    await expect(canvas.queryByText(/^~\d/)).toBeNull()
  },
}

/** A failed analysis (27 §3.11): what happened and why in one unboxed message, Try again and the
 * way back; Play stays the screen's one filled control. */
export const AnalysisFailed: Story = {
  render: screen([], { analysisFailed: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const failure = await canvas.findByRole('alert', undefined, { timeout: 20_000 })
    await expect(within(failure).getByText(m['analysis.failed']())).toBeVisible()
    const retry = within(failure).getByRole('button', { name: m['common.try_again']() })
    await expect(retry).toBeVisible()
    await expect(
      isFilled(retry, within(failure).getByRole('link', { name: 'Back to the library' })),
    ).toBe(false)
    await expect(
      within(failure).getByRole('link', { name: m['practice.back_to_library']() }),
    ).toBeVisible()
    await expect(getComputedStyle(failure).borderTopWidth).toBe('0px')
  },
}

/** The failure on a phone: the same message in the paper, above the transport. */
export const AnalysisFailedPhone: Story = {
  beforeEach: phone,
  render: screen([], { analysisFailed: true }),
  globals: { appearance: 'light', ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const failure = await canvas.findByRole('alert', undefined, { timeout: 20_000 })
    await expect(within(failure).getByRole('button', { name: 'Try again' })).toBeVisible()
    const transport = canvas.getByRole('toolbar', { name: 'Playback' }).getBoundingClientRect()
    await expect(failure.getBoundingClientRect().bottom).toBeLessThanOrEqual(transport.top)
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

/** + stems + chords: the chord strip over the chord sheet, and the mix named on Tools. */
export const Chords: Story = {
  render: screen(['beats', 'stems', 'chords'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    // The chord sheet's code loads on demand.
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(sheet).toBeVisible())
    await expect(canvasElement.querySelector('[data-slot=chord-strip]')).toBeVisible()
    await waitFor(() => expect(toolsButton(canvas)).toHaveAccessibleName(MIXED))
  },
}

/** The chord sheet's marks (26 §5): every name in ink; a probable chord has a dotted edge, an
 * unsure one a dashed edge and a "?", named for screen readers; the playing bar has a 2 px ink
 * line under it, and the loop an ink line along its top. Sharps are set as ♯, as on the strip. */
const chordSheetMarks: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = await playable(canvasElement)
  const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
  await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
  const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
  await waitFor(() => expect(sheet).toBeVisible())
  const chords = [...sheet.querySelectorAll<HTMLElement>('[data-slot=sheet-chord]')]
  const ink = getComputedStyle(
    chords.find((c) => c.getAttribute('data-confidence') === 'high') as HTMLElement,
  ).color
  const marked = chords.filter((c) => c.getAttribute('data-confidence') !== 'high')
  await expect(marked.length).toBeGreaterThan(0)
  for (const element of marked) {
    const low = element.getAttribute('data-confidence') === 'low'
    await expect(getComputedStyle(element).borderTopStyle).toBe(low ? 'dashed' : 'dotted')
    if (low) await expect(element).toHaveTextContent(/\?, Unsure$/)
    // The name stays ink: the edge carries the confidence, never the hue.
    await expect(getComputedStyle(element).color).toBe(ink)
  }
  await expect(sheet).toHaveTextContent(/F♯m/)
  await expect(sheet).not.toHaveTextContent(/F#/)
  const looped = sheet.querySelector<HTMLElement>('[data-slot=bar-target][aria-pressed=true]')
  await expect(looped && getComputedStyle(looped).borderTopWidth).toBe('2px')
}

export const ChordSheetMarks: Story = {
  render: screen(ALL, { chords: MANY_CHORDS }, { loop: '3-4' }),
  play: chordSheetMarks,
}

export const ChordSheetMarksDaylight: Story = {
  render: screen(ALL, { chords: MANY_CHORDS }, { loop: '3-4' }),
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: chordSheetMarks,
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

/** Master volume behind its icon at the transport's end: the fader by keyboard, mute, and unmute
 * back to that level. */
export const Volume: Story = {
  render: screen(ALL),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /^Volume: 100\s%$/ }))
    const group = within(canvasElement.ownerDocument.body)
    const fader = await group.findByRole('slider', { name: 'Volume' }, { timeout: 10_000 })
    fader.focus()
    await userEvent.keyboard('{PageDown}')
    await expect(fader).toHaveAttribute('aria-valuenow', '90')
    const mute = group.getByRole('button', { name: 'Mute' })
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

/** The tools panel is closed by default, so the music has the width; at 1180 Tools docks it
 * beside the music, never over it (27 §3.7.1). */
export const LoopActive1180: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1180' } },
  play: async (context) => {
    await loopActive(context)
    const canvas = within(context.canvasElement)
    await expect(canvas.queryByRole('complementary', { name: 'Practice tools' })).toBeNull()
    await userEvent.click(toolsButton(canvas))
    const panel = await canvas.findByRole(
      'complementary',
      { name: 'Practice tools' },
      { timeout: 10_000 },
    )
    await waitFor(() => expect(panel).toBeVisible())
    const tab = canvas.getByRole('region', { name: 'Tab' }).getBoundingClientRect()
    await expect(panel.getBoundingClientRect().left).toBeGreaterThanOrEqual(tab.right - 1)
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
    await userEvent.click(toolsButton(canvas))
    const body = within(canvasElement.ownerDocument.body)
    const drawer = await body.findByRole('dialog', { name: 'Practice tools' }, { timeout: 10_000 })
    await waitFor(() => expect(drawer).toBeVisible())
    // It never covers the dock (2.4.11).
    const dock = canvas.getByRole('toolbar', { name: 'Playback' }).getBoundingClientRect()
    await expect(drawer.getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.top + 1)
  },
}

/** At 1000 px the tab still runs edge to edge with no strip over it: it prints its chord names
 * over the staff, and the key row under it carries the marks key and the level (27 §3.7.1). */
export const TabEdgeToEdge: Story = {
  render: screen(ALL),
  globals: { viewport: { value: 'desktop1000' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await waitFor(() => expect(tab).toBeVisible())
    await expect(canvasElement.querySelector('[data-slot=chord-strip]')).toBeNull()
    const keyRow = canvasElement.querySelector('[data-slot=key-row]') as HTMLElement
    await expect(keyRow).toBeVisible()
    await expect(within(keyRow).getByRole('button', { name: /^Level and capo:/ })).toBeVisible()
    const view = canvasElement.ownerDocument.defaultView as Window
    await expect(tab.getBoundingClientRect().width).toBeGreaterThan(view.innerWidth - 40)
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

/** A stored `stage` (26 §2): Dark at no less than Music-stand sizes, × 1.25. */
export const ReadyStage: Story = { render: screen(ALL), globals: { appearance: 'stage' } }

export const ReadyAtTheStand: Story = {
  render: screen(ALL),
  globals: { distance: 'stand' },
}

/** Many chords on the Chords view: the strip over the sheet holds the next six, fading out at its
 * end, and clips to its own width with the tools panel open, so nothing paints over the panel. */
export const ManyChords: Story = {
  render: screen(ALL, { chords: MANY_CHORDS }, { tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
    const strip = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('[data-slot=chord-strip]')
      if (!found) throw new Error('no strip yet')
      return found
    })
    const list = await within(strip).findByRole('list', { name: 'Chords' })
    await waitFor(() =>
      expect(within(list).getAllByRole('button').length).toBeGreaterThanOrEqual(6),
    )
    await expect(strip.scrollWidth).toBeGreaterThanOrEqual(strip.clientWidth)
    await expect(getComputedStyle(strip).overflowX).toBe('hidden')
    const panel = canvas.getByRole('complementary', { name: 'Practice tools' })
    await expect(strip.getBoundingClientRect().right).toBeLessThanOrEqual(
      panel.getBoundingClientRect().left + 1,
    )
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

/** A tab without chords on a phone: no strip over the tab, and the level and capo stay one tap
 * away at the end of the key row (the audit found them unreachable on phones). */
export const TabWithoutChordsPhone: Story = {
  beforeEach: () => coarse({ '(max-height: 640px)': true }),
  render: screen(['beats', 'stems', 'notes.guitar', 'tab.guitar', 'summary']),
  globals: { viewport: { value: 'mobile2', isRotated: true } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await waitFor(() => expect(tab).toBeVisible())
    await expect(canvasElement.querySelector('[data-slot=chord-strip]')).toBeNull()
    const keyRow = canvasElement.querySelector('[data-slot=key-row]') as HTMLElement
    await expect(within(keyRow).getByRole('button', { name: /^Level and capo:/ })).toBeVisible()
  },
}

/** On the Chords view, tap a chord in the strip: Fix mode opens on its bar in the tools panel
 * (27 §3.7.4). */
export const Editor: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
    const chips = await canvas.findByRole('list', { name: 'Chords' }, { timeout: 10_000 })
    await userEvent.click(within(chips).getAllByRole('button')[0] as HTMLElement)
    await toolsFrame(canvasElement, /^Fix/)
  },
}

/** On a tablet the editor is the sheet (until s43): from a chord in the Chords view's strip. */
export const EditorTablet: Story = {
  beforeEach: () => coarse(),
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const view = await canvas.findByRole('group', { name: 'View' }, { timeout: 10_000 })
    await userEvent.click(within(view).getByRole('button', { name: 'Chords' }))
    const strip = await canvas.findByRole('list', { name: 'Chords' }, { timeout: 10_000 })
    await userEvent.click(await within(strip).findByRole('button', { name: /^G/ }))
    const body = within(canvasElement.ownerDocument.body)
    const editor = await body.findByRole('dialog', { name: 'Edit this bar' }, { timeout: 10_000 })
    await expect(editor).toBeVisible()
  },
}

/** Tools names the mix in play and opens the tools panel; Mix is one of its tabs (27 §3.7.4). */
export const Mixer: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await waitFor(() => expect(toolsButton(canvas)).toHaveAccessibleName(MIXED))
    await userEvent.click(toolsButton(canvas))
    await userEvent.click(await canvas.findByRole('tab', { name: /^Mix/ }, { timeout: 10_000 }))
    await toolsFrame(canvasElement, /^Mix/)
    await expect(toolsButton(canvas)).toHaveAttribute('aria-pressed', 'true')
  },
}

/** On a tablet the tools panel is a drawer from the side that stops above the transport. */
export const MixerTablet: Story = {
  beforeEach: () => coarse(),
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(toolsButton(canvas))
    const body = within(canvasElement.ownerDocument.body)
    const drawer = await body.findByRole('dialog', { name: 'Practice tools' }, { timeout: 10_000 })
    await waitFor(() => expect(drawer).toBeVisible())
    const transport = canvas.getByRole('toolbar', { name: 'Playback' }).getBoundingClientRect()
    await expect(drawer.getBoundingClientRect().bottom).toBeLessThanOrEqual(transport.top + 1)
  },
}

/** A phone's Chords view is the glance view, read from the stand: the current chord over the next
 * one a size down, with nothing past its own region (the audit saw it run into the transport). */
export const GlancePhone: Story = {
  beforeEach: phone,
  render: screen(ALL, {}, { view: 'chords', loop: '5-6' }),
  globals: { ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const glance = await canvas.findByRole('region', { name: 'Current chord' }, { timeout: 10_000 })
    await expect(glance).toBeVisible()
    const now = glance.querySelector('[data-slot=glance-now]') as HTMLElement
    const next = glance.querySelector('[data-slot=glance-next] p:last-child') as HTMLElement | null
    if (next) {
      await expect(Number.parseFloat(getComputedStyle(now).fontSize)).toBeGreaterThan(
        Number.parseFloat(getComputedStyle(next).fontSize),
      )
    }
    await expect(glance.scrollWidth).toBeLessThanOrEqual(glance.clientWidth)
    const box = glance.getBoundingClientRect()
    const transport = canvas.getByRole('toolbar', { name: 'Playback' }).getBoundingClientRect()
    await expect(box.bottom).toBeLessThanOrEqual(transport.top + 1)
    // The tab is a tap away.
    const view = canvas.getByRole('group', { name: 'View' })
    await userEvent.click(within(view).getByRole('button', { name: 'Tab' }))
    await expect(
      await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 }),
    ).toBeInTheDocument()
  },
}

export const GlancePhoneDaylight: Story = {
  beforeEach: phone,
  render: screen(ALL, {}, { view: 'chords' }),
  globals: { appearance: 'light', ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(
      await canvas.findByRole('region', { name: 'Current chord' }, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Loop this bar' })).toBeVisible()
  },
}

/** The glance view alone at the Floor distance (26 §6.3): current and next chord, bar.beat, speed. */
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

/** Level and capo at the end of the key row under the tab (27 §3.7.1). */
export const LevelAndCapo: Story = {
  render: screen(ALL),
  play: opens(/^Level and capo: As played$/, m['practice.level_and_capo']()),
}

/** Bass: the level popover is titled "Level" and has no capo, like the drums'. */
export const BassLevel: Story = {
  render: screen(ALL_BASS, { instrument: 'bass', notes: BASS_LINE }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Level: As played$/ }))
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

/** The loop line opens the tools panel on Loop (27 §3.7.4). */
export const LoopOptions: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Loop · bars 5–6/ }))
    await toolsFrame(canvasElement, /^Loop/)
    await expect(canvas.getByRole('complementary', { name: 'Practice tools' })).toBeVisible()
  },
}

/** On a tablet the loop line opens the same panel as a drawer above the transport. */
export const LoopOptionsTablet: Story = {
  beforeEach: () => coarse(),
  render: screen(ALL, {}, { loop: '5-6' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /^Loop · bars 5–6/ }))
    await toolsFrame(canvasElement, /^Loop/)
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole('dialog', { name: 'Practice tools' })).toBeVisible()
  },
}

/** On a phone the loop line, in the status row, opens the panel as a sheet above the transport. */
export const LoopOptionsPhone: Story = {
  beforeEach: phone,
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { ...PHONE_375 },
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    const line = canvasElement.querySelector('[data-slot=loop-line]') as HTMLElement
    await expect(line).toHaveTextContent(/Loop · bars 5–6/)
    await userEvent.click(line)
    await toolsFrame(canvasElement, /^Loop/)
  },
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

/** `?`: the shortcuts overlay lists every practice key, grouped, as caps beside the action in
 * words, with one way to set up a pedal rather than a button per row. */
const shortcutsList: NonNullable<Story['play']> = async ({ canvasElement }) => {
  await playable(canvasElement)
  ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
  await userEvent.keyboard('?')
  const body = within(canvasElement.ownerDocument.body)
  const dialog = await body.findByRole('dialog', undefined, { timeout: 10_000 })
  await waitFor(() => expect(dialog).toBeVisible())
  const rows = dialog.querySelectorAll('[data-slot=shortcut-row]')
  // Every action in the key map, the loop and speed digits, and the palette, list and undo.
  await expect(rows.length).toBe(ACTIONS.length + 5)
  for (const row of rows) await expect(row.querySelector('kbd')).not.toBeNull()
  await expect(within(dialog).queryByRole('button', { name: /^Learn this pedal/ })).toBeNull()
  await expect(within(dialog).getByRole('link', { name: 'Set up a pedal' })).toBeVisible()
  for (const key of ['1', '2', '4', '8', 'X', 'V', 'U', 'Y', 'I', 'R']) {
    await expect(within(dialog).getAllByText(key, { selector: 'kbd' }).length).toBeGreaterThan(0)
  }
}

export const ShortcutsOverlay: Story = { render: screen(ALL), play: shortcutsList }

export const ShortcutsOverlayDaylight: Story = {
  render: screen(ALL),
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: shortcutsList,
}

/** On a phone the list is reached from ⋯ More (the audit found it desktop-only). */
export const ShortcutsOverlayPhone: Story = {
  beforeEach: phone,
  render: screen(ALL),
  globals: { ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole('button', { name: 'Keyboard shortcuts' }, { timeout: 10_000 }),
    )
    const dialog = await body.findByRole(
      'dialog',
      { name: 'Keyboard shortcuts' },
      { timeout: 10_000 },
    )
    await waitFor(() => expect(dialog).toBeVisible())
    const view = canvasElement.ownerDocument.defaultView as Window
    await expect(dialog.getBoundingClientRect().right).toBeLessThanOrEqual(view.innerWidth)
  },
}

/** ⋯ More on a phone: shortcuts, search and the pedal settings, each a row with its key. */
export const MorePanelPhone: Story = {
  beforeEach: phone,
  render: screen(ALL, { video: true }),
  globals: { appearance: 'light', ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More' }))
    const body = within(canvasElement.ownerDocument.body)
    const more = await body.findByRole('dialog', { name: 'More' }, { timeout: 10_000 })
    // Popups fade in (26 §10).
    for (const name of ['Keyboard shortcuts', 'Search songs, clips and actions', 'Video']) {
      await waitFor(() => expect(within(more).getByRole('button', { name })).toBeVisible())
    }
    await expect(within(more).getByRole('link', { name: 'Keyboard & pedal' })).toBeVisible()
  },
}

/** Display and reading on a phone: the popover fits the width, its groups divided by hairlines. */
export const DisplayPopoverPhone: Story = {
  beforeEach: phone,
  render: screen(ALL),
  globals: { appearance: 'light', ...PHONE_375 },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Display and reading' }))
    const body = within(canvasElement.ownerDocument.body)
    const popup = await body.findByRole(
      'dialog',
      { name: 'Display and reading' },
      { timeout: 10_000 },
    )
    await waitFor(() => expect(popup).toBeVisible())
    const view = canvasElement.ownerDocument.defaultView as Window
    const box = popup.getBoundingClientRect()
    await expect(box.left).toBeGreaterThanOrEqual(0)
    await expect(box.right).toBeLessThanOrEqual(view.innerWidth)
    await expect(within(popup).getByRole('switch', { name: 'Show uncertainty' })).toHaveAttribute(
      'aria-keyshortcuts',
      'U',
    )
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
    await expect(await canvas.findByRole('button', { name: /^Loop · bars 3–4/ })).toBeVisible()
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
    await expect(await canvas.findByRole('button', { name: /^Loop · bars 3–4/ })).toBeVisible()
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
    await userEvent.click(await canvas.findByRole('button', { name: /^Level and capo:/ }))
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
    await expect(await canvas.findByRole('button', { name: /^Loop · bars 3–4/ })).toBeVisible()
    await expect(within(strip).getByRole('button', { name: 'Loop this phrase' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.keyboard('p')
    await waitFor(() => expect(hud()).toHaveTextContent('C5'))
    // Back a phrase ("[[" types "["): the loop moves with it.
    await userEvent.keyboard('[[')
    await expect(await canvas.findByRole('button', { name: /^Loop · bars 1–2/ })).toBeVisible()

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
    await expect(await canvas.findByRole('button', { name: /^Loop · bars 3–4/ })).toBeVisible()
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

/** ?tab=mix opens the tools panel on Mix (27 §1), docked beside the music. */
export const InspectorMix: Story = {
  render: screen(ALL, {}, { tab: 'mix' }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await toolsFrame(canvasElement, /^Mix/)
    const panel = canvas.getByRole('complementary', { name: 'Practice tools' })
    const view = canvasElement.ownerDocument.defaultView as Window
    await expect(Math.round(panel.getBoundingClientRect().right)).toBe(view.innerWidth)
    // Escape closes it and gives the music its width back.
    within(panel).getByRole('tab', { name: /^Mix/ }).focus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(canvas.queryByRole('complementary', { name: 'Practice tools' })).toBeNull(),
    )
  },
}

/** Mix before the stems: the panel opens on Mix while the analysis runs. */
export const InspectorMixBeforeStems: Story = {
  render: screen(['beats', 'chords'], { running: true }, { tab: 'mix' }),
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    await toolsFrame(canvasElement, /^Mix/)
  },
}

/** ?tab=progress opens the panel on Progress. */
export const InspectorProgress: Story = {
  render: screen(ALL, {}, { tab: 'progress' }),
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    await toolsFrame(canvasElement, /^Progress/)
  },
}

/** `?tab=fix` enters Fix mode; the Fix tab carries the unsure count, in words for screen readers
 * (the Fix stories are in fix.stories.tsx). */
export const InspectorFix: Story = {
  render: screen(ALL, {}, { tab: 'fix' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await toolsFrame(canvasElement, /^Fix/)
    await expect(canvas.getByRole('tab', { name: /^Fix/ })).toHaveTextContent('1')
  },
}

/** ?tab=loop with no loop yet opens the panel on Loop. */
export const InspectorLoopEmpty: Story = {
  render: screen(ALL, {}, { tab: 'loop' }),
  play: async ({ canvasElement }) => {
    await playable(canvasElement)
    await toolsFrame(canvasElement, /^Loop/)
  },
}

/** Before the beat is found Tools still opens the panel beside Getting ready; Tools says
 * "Tools" until there is a mix to name. */
export const InspectorLoopBeforeBeats: Story = {
  render: screen([], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(canvas.queryByRole('complementary', { name: 'Practice tools' })).toBeNull()
    await expect(toolsButton(canvas)).toHaveAccessibleName('Tools')
    await userEvent.click(toolsButton(canvas))
    await toolsFrame(canvasElement, /^(Loop|Mix|Progress)/)
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
    const prompt = await canvas.findByRole('group', { name: /^Pass 2 at 70\s% — how was it\?$/ })
    await waitFor(() =>
      expect(prompt.querySelector('[data-slot=pass-question]')).toHaveTextContent(
        /^Pass 2 at 70\s% — how was it\?$/,
      ),
    )
  },
}

/** The pass prompt in the transport after a pass (27 §3.7.1): "Pass 2 at 70 % — how was it?",
 * Felt clean and Not yet at the 48 px practice target, in the loop line's place; it never covers
 * a focused control (2.4.11). */
export const PassPrompt: Story = {
  render: screen(ALL, {}, { loop: '5-6', speed: 70 }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    usePracticeUi.setState({ promptPass: 2 })
    const prompt = await canvas.findByRole('group', { name: /^Pass 2 at 70\s% — how was it\?$/ })
    // It fades in (26 §10).
    await waitFor(() =>
      expect(prompt.querySelector('[data-slot=pass-question]')).toHaveTextContent(
        /^Pass 2 at 70\s% — how was it\?$/,
      ),
    )
    const clean = within(prompt).getByRole('button', { name: /^Felt clean/ })
    await atLeast(clean, 48)
    await atLeast(within(prompt).getByRole('button', { name: /^Not yet/ }), 48)
    const transport = canvas.getByRole('toolbar', { name: 'Playback' })
    await expect(transport).toContainElement(prompt)
    // Focus not obscured: tab through the dock; no focused control is fully under the prompt.
    const doc = canvasElement.ownerDocument
    const dock = canvas.getByRole('toolbar', { name: 'Playback' })
    // The prompt's own answers are measured above; every other control stays uncovered by it.
    for (const control of within(dock)
      .getAllByRole('button')
      .filter((b) => !prompt.contains(b))) {
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
      await expect(visible, control.textContent ?? '').toBe(true)
    }
    await userEvent.click(clean)
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot=pass-control][data-prompting]')).toBeNull(),
    )
  },
}

/** The transport's targets (26 §8): Play at 64, every other control at the 48 px practice
 * target; the top bar's icon buttons at the 44 px floor. */
export const DockTargets: Story = {
  render: screen(ALL, {}, { loop: '5-6' }),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const dock = within(canvas.getByRole('toolbar', { name: 'Playback' }))
    const play = dock.getByRole('button', { name: 'Play' })
    await atLeast(play, 64)
    const buttons = dock.getAllByRole('button').filter((b) => b !== play && b.offsetParent)
    await expect(buttons.length).toBeGreaterThan(9)
    for (const button of buttons) await atLeast(button, 48)
    await atLeast(toolsButton(canvas), 48)
    await atLeast(canvas.getByRole('button', { name: 'Display and reading' }), 44)
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
    await waitFor(() => expect(hud()).toHaveTextContent(/Key \..*Speed 75/))
    await userEvent.keyboard(',,')
    await waitFor(() => expect(readout()).toHaveAccessibleName(/^Speed: 65\s%/))
    await userEvent.keyboard('{Shift>}>{/Shift}')
    await waitFor(() => expect(readout()).toHaveAccessibleName(/^Speed: 66\s%/))
    // The readout counts to the new speed (26 §10) before its label and text agree again.
    await waitFor(() => expect(shownSpeed(readout())).toHaveTextContent(/^66/))
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

/** A stored `stage` in the Display popover: Dark is chosen and the distance it resolved
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
    const night = await within(popup).findByRole('button', { name: 'Dark' })
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

/** Getting ready in Light at 1440 (Practice-Ready.dc.html). */
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

// ── The speed ladder and saved clips (27 §3.7.4, 12 §5, Main.dc.html; s37) ──────────────────────
// The song opens on its saved clip "Chorus riff" (bars 5–6) with the Loop tab showing; the clip's
// stored trainer puts the ladder where each story needs it.
type Trainer = NonNullable<StoryClip['trainer']>
const BRIDGE = storyClip(2, 'Bridge bends', 3, 4, { best_clean_tempo_pct: 65 })
const ladderScreen = (trainer: Trainer | null, patch: Patch = {}) =>
  screen(
    ALL,
    {
      clips: [storyClip(1, 'Chorus riff', 5, 6, { trainer, best_clean_tempo_pct: 80 }), BRIDGE],
      ...patch,
    },
    { tab: 'loop' },
  )

const ladderCard = async (canvasElement: HTMLElement) => {
  const canvas = await playable(canvasElement)
  const panel = await canvas.findByRole('tabpanel')
  const card = await within(panel).findByRole(
    'region',
    { name: m['ladder.title']() },
    { timeout: 10_000 },
  )
  const hud = () => canvasElement.ownerDocument.querySelector('[data-slot=pedal-hud]')
  /** The dock's readout once its number has counted to the new speed (26 §10). */
  const speedIs = (pct: number) =>
    waitFor(() =>
      expect(shownSpeed(canvas.getByRole('button', { name: /^Speed: / }))).toHaveTextContent(
        new RegExp(`^${pct}\\s%`),
      ),
    )
  return { canvas, panel, card: within(card), hud, speedIs }
}

/** Ladder off: the card keeps its switch and says what the ladder does. Switching it on starts
 * from the clip's best clean pass (80 %) and says so in the PedalHud. */
export const LadderOff: Story = {
  render: ladderScreen(null),
  play: async ({ canvasElement }) => {
    const { canvas, card, hud, speedIs } = await ladderCard(canvasElement)
    const toggle = card.getByRole('switch', { name: m['ladder.title']() })
    await expect(toggle).not.toBeChecked()
    await expect(card.getByText(m['ladder.off_hint']())).toBeVisible()
    await expect(card.queryByRole('img')).toBeNull()
    await userEvent.click(toggle)
    await expect(
      await card.findByRole('img', { name: '80 percent now, 85 percent next' }),
    ).toBeVisible()
    await waitFor(() => expect(hud()).toHaveTextContent(/Speed 80\s% · ladder/))
    await expect(await canvas.findByRole('button', { name: /^Speed: 80\s%.*→ 100/ })).toBeVisible()
    await speedIs(80)
  },
}

/** 'On for new loops' in Settings (off by default): a new loop starts on the ladder at 70 %, and
 * a learner already slower than that keeps their speed as the first rung. */
export const LadderOnForNewLoops: Story = {
  beforeEach: () => {
    usePracticeDefaults.getState().update({ ladderNewLoops: true })
    return () => usePracticeDefaults.getState().update({ ladderNewLoops: false })
  },
  render: screen(ALL, {}, { loop: '5-6', tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const { canvas, card, hud, speedIs } = await ladderCard(canvasElement)
    await expect(
      await card.findByRole('img', { name: '70 percent now, 75 percent next' }),
    ).toBeVisible()
    await waitFor(() => expect(hud()).toHaveTextContent(/Speed 70\s% · ladder/))
    await expect(await canvas.findByRole('button', { name: /^Speed: 70\s%.*→ 100/ })).toBeVisible()
    await speedIs(70)
  },
}

/** A new loop with the setting off (the default): the card is there, the ladder is off and the
 * speed stays where it was. */
export const LadderOffForNewLoops: Story = {
  render: screen(ALL, {}, { loop: '5-6', tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const { canvas, card } = await ladderCard(canvasElement)
    await expect(card.getByRole('switch', { name: m['ladder.title']() })).not.toBeChecked()
    await expect(canvas.getByRole('button', { name: /^Speed: 100\s%/ })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /→ 100/ })).toBeNull()
  },
}

/** On, at the first rung: nothing done yet, the summary names the pass that moves up. */
export const LadderAtStart: Story = {
  render: ladderScreen(storyLadder()),
  play: async ({ canvasElement }) => {
    const { canvas, card, speedIs } = await ladderCard(canvasElement)
    await expect(card.getByRole('switch', { name: m['ladder.title']() })).toBeChecked()
    await expect(card.getByRole('img', { name: '70 percent now, 75 percent next' })).toBeVisible()
    await expect(
      card.getByText(
        /^Up 5\s% after 3 clean passes\. Clean pass 1 of 3 at 70\s%\. Pass 3 moves you to 75\s%\.$/,
      ),
    ).toBeVisible()
    // The dock: the loop pill names the pass and the readout the goal (27 §3.7.1).
    await expect(
      canvas.getByRole('button', { name: /^Loop · bars 5–6, pass 1 of 3 at 70\s%/ }),
    ).toBeVisible()
    await expect(
      await canvas.findByRole('button', {
        name: /^Speed: 70\s% · 70\sBPM · → 100, ladder goal 100\s%$/,
      }),
    ).toBeVisible()
    await speedIs(70)
  },
}

/** Climbing (Main.dc.html): 70 done, 75 current. Two more clean passes (C) move it to 80 %: the
 * rungs, the summary, the loop bracket and the PedalHud all say so. */
export const LadderClimbing: Story = {
  render: ladderScreen(storyLadder({ current_pct: 75, clean_count: 1 })),
  play: async ({ canvasElement }) => {
    const { canvas, card, hud, speedIs } = await ladderCard(canvasElement)
    await expect(
      card.getByRole('img', { name: '70 percent done, 75 percent now, 80 percent next' }),
    ).toBeVisible()
    await expect(
      card.getByText(/Clean pass 2 of 3 at 75\s%\. Pass 3 moves you to 80\s%\.$/),
    ).toBeVisible()
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot=loop-badge]')).toHaveTextContent(
        /Loop · bars 5–6 · pass 2 of 3 at 75\s%/,
      ),
    )
    await userEvent.keyboard('c')
    await expect(
      await card.findByText(/Clean pass 3 of 3 at 75\s% moves you to 80\s%\.$/),
    ).toBeVisible()
    await userEvent.keyboard('c')
    await expect(
      await card.findByRole('img', {
        name: '70 and 75 percent done, 80 percent now, 85 percent next',
      }),
    ).toBeVisible()
    await waitFor(() => expect(hud()).toHaveTextContent(/Speed 80\s% · ladder/))
    await expect(await canvas.findByRole('button', { name: /^Speed: 80\s%/ })).toBeVisible()
    await speedIs(80)
  },
}

/** Dropping back: two "Not yet" in a row (N) at 80 % go down one rung to 75 %. */
export const LadderDroppingBack: Story = {
  render: ladderScreen(storyLadder({ current_pct: 80, clean_count: 1 })),
  play: async ({ canvasElement }) => {
    const { card, hud, speedIs } = await ladderCard(canvasElement)
    await expect(
      card.getByRole('img', { name: '70 and 75 percent done, 80 percent now, 85 percent next' }),
    ).toBeVisible()
    await userEvent.keyboard('n')
    await expect(card.getByRole('img', { name: /80 percent now/ })).toBeVisible()
    await userEvent.keyboard('n')
    await expect(
      await card.findByRole('img', { name: '70 percent done, 75 percent now, 80 percent next' }),
    ).toBeVisible()
    await waitFor(() => expect(hud()).toHaveTextContent(/Speed 75\s% · ladder/))
    await expect(card.getByText(/Clean pass 1 of 3 at 75\s%/)).toBeVisible()
    await speedIs(75)
  },
}

/** At the goal, keep looping: every rung before it done, and the summary says it keeps going. */
export const LadderAtGoalKeep: Story = {
  render: ladderScreen(storyLadder({ current_pct: 100, clean_count: 3 })),
  play: async ({ canvasElement }) => {
    const { canvas, card, speedIs } = await ladderCard(canvasElement)
    await expect(
      card.getByRole('img', { name: '70 to 95 percent done, at the goal of 100 percent' }),
    ).toBeVisible()
    await expect(
      card.getByText(/You're at the goal: the loop keeps going at 100\s%\.$/),
    ).toBeVisible()
    await userEvent.keyboard('c')
    await expect(await canvas.findByRole('button', { name: /^Speed: 100\s%/ })).toBeVisible()
    await speedIs(100)
  },
}

/** At the goal with Stop chosen: the last clean pass ends the loop. */
export const LadderAtGoalStop: Story = {
  render: ladderScreen(storyLadder({ current_pct: 100, clean_count: 2, on_goal: 'stop' })),
  play: async ({ canvasElement }) => {
    const { card, speedIs } = await ladderCard(canvasElement)
    await expect(card.getByText(/Clean pass 3 of 3 at 100\s% ends the loop\.$/)).toBeVisible()
    await speedIs(100)
  },
}

/** Long values: Goal 110 %, Step 1 %, 12 clean passes. 61 rungs show as the nine around the
 * current one, the chips wrap, and nothing spills out of the card. */
export const LadderLongValues: Story = {
  render: ladderScreen(
    storyLadder({
      start_pct: 50,
      end_pct: 110,
      step_pct: 1,
      plays_per_step: 12,
      current_pct: 78,
      clean_count: 11,
    }),
  ),
  play: async ({ canvasElement }) => {
    const { canvas, panel, card, speedIs } = await ladderCard(canvasElement)
    await expect(
      card.getByRole('img', { name: '50 to 77 percent done, 78 percent now, 79 percent next' }),
    ).toBeVisible()
    await expect(card.getByRole('button', { name: /^Goal 110\s%$/ })).toBeVisible()
    await expect(card.getByRole('button', { name: /^Step 1\s%$/ })).toBeVisible()
    await expect(card.getByRole('button', { name: '12 clean passes' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /→ 110/ })).toBeVisible()
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth)
    await speedIs(78)
  },
}

/** Each chip opens its stepper (48 px halves, 26 §8); a step changes the ladder at once. */
export const LadderChips: Story = {
  render: ladderScreen(storyLadder()),
  play: async ({ canvasElement }) => {
    const { card, speedIs } = await ladderCard(canvasElement)
    const chips = card.getAllByRole('button')
    await expect(chips.map((chip) => chip.textContent?.replace(/\s/g, ' '))).toEqual([
      'Start 70 %',
      'Goal 100 %',
      'Step 5 %',
      '3 clean passes',
      'More',
    ])
    for (const chip of chips) await atLeast(chip, 48)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(card.getByRole('button', { name: '3 clean passes' }))
    const fewer = await body.findByRole('button', { name: m['ladder.fewer_passes']() })
    // Popups zoom in (26 §10): measured once they have settled.
    await waitFor(() => atLeast(fewer, 48))
    await atLeast(body.getByRole('button', { name: m['ladder.more_passes']() }), 48)
    await userEvent.click(fewer)
    await expect(await card.findByRole('button', { name: '2 clean passes' })).toBeVisible()
    await expect(card.getByText(/^Up 5\s% after 2 clean passes\./)).toBeVisible()
    await userEvent.keyboard('{Escape}')
    // Raising the start past the speed moves the loop onto the new first rung.
    await userEvent.click(card.getByRole('button', { name: /^Start 70\s%$/ }))
    await userEvent.click(await body.findByRole('button', { name: m['ladder.start_raise']() }))
    await expect(
      await card.findByRole('img', { name: '75 percent now, 80 percent next' }),
    ).toBeVisible()
    await speedIs(75)
  },
}

/** More: back down after misses (0 turns it off), count-in before each pass, at the goal. */
export const LadderMore: Story = {
  render: ladderScreen(storyLadder()),
  play: async ({ canvasElement }) => {
    const { card, speedIs } = await ladderCard(canvasElement)
    await userEvent.click(card.getByRole('button', { name: m['ladder.chip_more']() }))
    const body = within(canvasElement.ownerDocument.body)
    const fewer = await body.findByRole('button', { name: m['ladder.fewer_misses']() })
    await waitFor(() =>
      expect(body.getByText('After 2 misses in a row, one step down.')).toBeVisible(),
    )
    await userEvent.click(fewer)
    await userEvent.click(fewer)
    await waitFor(() => expect(body.getByText(m['ladder.back_down_off']())).toBeVisible())
    await expect(body.getByRole('switch', { name: m['ladder.count_in_each']() })).toBeChecked()
    await userEvent.click(body.getByRole('button', { name: m['ladder.on_goal_stop']() }))
    await waitFor(() =>
      expect(body.getByRole('button', { name: m['ladder.on_goal_stop']() })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
    await speedIs(70)
  },
}

/** The ladder in Light at 1440: done rungs carry the 1 px edge (V16). */
export const LadderDaylight: Story = {
  render: ladderScreen(storyLadder({ current_pct: 80 })),
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const { card, speedIs } = await ladderCard(canvasElement)
    const ladder = card.getByRole('img', { name: /80 percent now/ })
    const done = ladder.querySelector('[data-state=done]') as HTMLElement
    const upcoming = ladder.querySelector('[data-state=upcoming]') as HTMLElement
    await expect(getComputedStyle(done).boxShadow).not.toBe('none')
    await expect(getComputedStyle(upcoming).boxShadow).not.toBe(getComputedStyle(done).boxShadow)
    await speedIs(80)
  },
}

/** The ladder at 1180 (Main.dc.html's narrower frame). */
export const Ladder1180: Story = {
  render: ladderScreen(storyLadder({ current_pct: 75, clean_count: 1 })),
  globals: { viewport: { value: 'desktop1180' } },
  play: async ({ canvasElement }) => {
    const { panel, card, speedIs } = await ladderCard(canvasElement)
    await expect(card.getByRole('img', { name: /75 percent now/ })).toBeVisible()
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth)
    await speedIs(75)
  },
}

export const LadderIncreasedContrast: Story = {
  render: ladderScreen(storyLadder({ current_pct: 80 })),
  globals: { contrast: 'more' },
  play: async ({ canvasElement }) => {
    const { card, speedIs } = await ladderCard(canvasElement)
    await expect(card.getByRole('img', { name: /80 percent now/ })).toBeVisible()
    await speedIs(80)
  },
}

/** Reduced motion: a step still shows at once (the rungs change state, nothing slides). */
export const LadderReducedMotion: Story = {
  render: ladderScreen(storyLadder({ current_pct: 75, clean_count: 2 })),
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const { card, speedIs } = await ladderCard(canvasElement)
    await userEvent.keyboard('c')
    await expect(await card.findByRole('img', { name: /80 percent now/ })).toBeVisible()
    await speedIs(80)
  },
}

/** `v1.speed_trainer` off: no ladder card, no goal in the readout; the rest of the tab stays. */
export const LadderFlagOff: Story = {
  render: ladderScreen(storyLadder(), { ladderFlagOff: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const panel = await canvas.findByRole('tabpanel')
    await expect(
      await within(panel).findByRole('heading', { name: 'Bars 5–6' }, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(within(panel).queryByRole('region', { name: m['ladder.title']() })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /→ 100/ })).toBeNull()
    await expect(within(panel).getByText('Chorus riff')).toBeVisible()
  },
}

/** Saved clips: the ink dot on the one playing, "bars 5–6 · best 80 %", and a More menu per
 * row. Another clip's row loops it as it was left (no ladder on that one). */
export const SavedClips: Story = {
  render: ladderScreen(storyLadder()),
  play: async ({ canvasElement }) => {
    const { panel } = await ladderCard(canvasElement)
    const chorus = within(panel).getByRole('button', { name: /^Chorus riff/ })
    await expect(chorus).toHaveAttribute('aria-current', 'true')
    await expect(chorus).toHaveTextContent(/bars 5–6 · best 80\s%/)
    await atLeast(within(panel).getByRole('button', { name: 'More for Chorus riff' }), 48)
    await userEvent.click(within(panel).getByRole('button', { name: /^Bridge bends/ }))
    await expect(await within(panel).findByRole('heading', { name: 'Bars 3–4' })).toBeVisible()
    await expect(within(panel).getByRole('switch', { name: m['ladder.title']() })).not.toBeChecked()
  },
}

/** Rename in progress: the row's name becomes a field holding the old name, selected. Escape
 * keeps the name. */
export const ClipRename: Story = {
  render: ladderScreen(storyLadder()),
  play: async ({ canvasElement }) => {
    const { panel } = await ladderCard(canvasElement)
    await userEvent.click(within(panel).getByRole('button', { name: 'More for Bridge bends' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('menuitem', { name: m['practice.clip_rename']() }))
    const field = await within(panel).findByRole('textbox', { name: 'New name for Bridge bends' })
    await waitFor(() => expect(field).toHaveFocus())
    await expect(field).toHaveValue('Bridge bends')
    await userEvent.keyboard('Bridge, slower')
    await expect(field).toHaveValue('Bridge, slower')
    await expect(
      within(panel).getByRole('button', { name: m['practice.clip_rename_save']() }),
    ).toBeEnabled()
  },
}

/** Delete with Undo (26 §8: undoable, no confirm): the row goes at once, the toast offers Undo,
 * and Undo brings the same clip back. */
export const ClipDeleteUndo: Story = {
  render: () => <Toaster closeLabel={m['system.close']()}>{ladderScreen(storyLadder())()}</Toaster>,
  play: async ({ canvasElement }) => {
    const { panel } = await ladderCard(canvasElement)
    await userEvent.click(within(panel).getByRole('button', { name: 'More for Bridge bends' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('menuitem', { name: m['practice.clip_delete']() }))
    await waitFor(() =>
      expect(within(panel).queryByRole('button', { name: /^Bridge bends/ })).toBeNull(),
    )
    await expect(await body.findByText('Deleted Bridge bends')).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: m['practice.clip_undo']() }))
    await expect(await within(panel).findByRole('button', { name: /^Bridge bends/ })).toBeVisible()
    await expect(within(panel).getByRole('button', { name: /^Bridge bends/ })).toHaveTextContent(
      /bars 3–4 · best 65\s%/,
    )
  },
}
