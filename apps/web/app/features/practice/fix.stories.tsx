import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { m } from '@/lib/i18n'
import { Toaster } from '@/ui/toast'
import { AppStory } from '../../../.storybook/app.tsx'
import { EditPage } from './edit-page'
import { useFix } from './fix-store'
import { configureCorrections, useCorrections } from './model/corrections'
import { memoryOutbox } from './model/outbox-memory'
import type { PracticeSearch } from './practice-context'
import { PracticePage } from './practice-page'
import {
  ALL,
  FIX_CHORDS,
  FIX_CHORDS_LONG,
  FIX_CHORDS_REPEAT,
  FIX_NOTES_MANY,
  FIX_NOTES_SHAKY,
  FIX_NOTES_SURE,
  type Patch,
  SONG_ID,
  seed,
  tone,
} from './practice-story-data'

// Fix mode (27 §3.7.4, Practice-Fix.dc.html) on the contracts' 8-bar fixture with spots to fix:
// its one unsure note (bar 4), an unsure G over bars 7–8 whose second guess is E minor, and an
// unsure F over bars 3–4 whose second guess is Fmaj7. The queue ranks the note first, then the
// chord whose root is in question, then the one whose quality is. Edits stay on the device here:
// nothing reaches the network, so they show as queued.
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
}
const meta = {
  title: 'Screens/Practice Fix',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
  // Every story starts with no edits, and leaves none for the next.
  beforeEach: () => {
    const reset = () => {
      useCorrections.setState({
        pending: [],
        undo: [],
        redo: [],
        rejected: 0,
        offline: false,
        hydrated: true,
      })
      useFix.setState({ audition: null, replaceable: null, speedPct: null, focus: false })
    }
    configureCorrections({ db: memoryOutbox() })
    reset()
    return reset
  },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const FIX: Patch = { chords: FIX_CHORDS }

const screen =
  (patch: Patch = FIX, search: PracticeSearch = { tab: 'fix' }) =>
  () => (
    <Toaster closeLabel={m['system.close']()}>
      <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL, patch)}>
        <PracticePage songId={SONG_ID} search={search} fetchAudio={tone} />
      </AppStory>
    </Toaster>
  )

/** Fix mode with its first spot selected and the audio ready. */
const fixing = async (canvasElement: HTMLElement, spot = /^Spot 1 of \d+ · bar/) => {
  const canvas = within(canvasElement)
  const panel = within(await canvas.findByRole('tabpanel', undefined, { timeout: 20_000 }))
  await panel.findByRole('heading', { name: spot }, { timeout: 20_000 })
  const dock = within(await canvas.findByRole('toolbar', { name: 'Playback' }))
  await waitFor(() => expect(dock.getByRole('button', { name: /^Play bar/ })).toBeEnabled(), {
    timeout: 20_000,
  })
  return { canvas, panel, dock, body: within(canvasElement.ownerDocument.body) }
}

/** Keys go to the page, as a pedal's do. */
const press = async (keys: string) => {
  ;(document.activeElement as HTMLElement | null)?.blur()
  await userEvent.keyboard(keys)
}

const atLeast = async (element: HTMLElement, size: number) => {
  const box = element.getBoundingClientRect()
  await expect(Math.round(box.height)).toBeGreaterThanOrEqual(size)
  await expect(Math.round(box.width)).toBeGreaterThanOrEqual(size)
}

/** Nothing marked unsure (27 §4): the tab says so; Fix mode is on, with the usual transport. */
export const Empty: Story = {
  render: screen({ notes: FIX_NOTES_SURE }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(m['practice.fix_empty'](), undefined, { timeout: 20_000 }),
    ).toBeVisible()
    await expect(await canvas.findByText(m['fix.fixing']())).toBeVisible()
    await expect(canvas.getByRole('button', { name: m['fix.done']() })).toBeVisible()
    await expect(canvas.getByRole('tab', { name: /^Fix$/ })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible()
  },
}

/** Choosing Fix selects the first spot of the queue: the unsure note (a wrong pitch costs most),
 * its bar looping in the Fix dock, the key line under the notation, the pill in the top bar. */
export const FirstSpot: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { canvas, panel, dock } = await fixing(canvasElement)
    await expect(panel.getByRole('heading', { name: 'Spot 1 of 3 · bar 4' })).toBeVisible()
    await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    await expect(canvas.getByRole('tab', { name: /^Fix/ })).toHaveTextContent('3')
    await expect(panel.getByRole('region', { name: 'Bar 4 · note 2' })).toBeVisible()
    await expect(dock.getByText('Bar 4')).toBeVisible()
    await expect(dock.getByText(m['fix.dock_hint']())).toBeVisible()
    await expect(dock.getByRole('group', { name: 'Listen to' })).toBeVisible()
    await expect(canvas.getByText(/^Unsure: we'd guess wrong about 1 time in \d+$/)).toBeVisible()
    await expect(canvas.getByText(m['fix.fixing']())).toBeVisible()
    // The top bar keeps only Display and More beside the pill: no legend chip while fixing.
    await expect(canvas.queryByRole('button', { name: /Auto-transcribed/ })).toBeNull()
  },
}

/** A note spot (27 §3.7.4): the note with its "?", String and Fret, It's right, Delete note and
 * Report wrong. "It's right" takes the mark off and the spot out of the queue. */
export const NoteSpot: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { canvas, panel, body } = await fixing(canvasElement)
    const card = within(panel.getByRole('region', { name: 'Bar 4 · note 2' }))
    await expect(
      card.getByRole('button', { name: 'C3 · string 5, fret 3, Unsure', pressed: true }),
    ).toBeVisible()
    await expect(card.getByRole('textbox', { name: 'String' })).toHaveValue('5')
    await expect(card.getByRole('textbox', { name: 'Fret' })).toHaveValue('3')
    await expect(card.getByRole('button', { name: 'Delete note' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Report wrong' })).toBeVisible()
    await userEvent.click(card.getByRole('button', { name: "It's right" }))
    await expect(await body.findByText('Edit saved · bar 4')).toBeVisible()
    await waitFor(() => expect(canvas.getByRole('tab', { name: /^Fix/ })).toHaveTextContent('2'))
    await expect(
      card.getByRole('button', { name: 'C3 · string 5, fret 3', pressed: true }),
    ).toBeVisible()
    await expect(card.queryByRole('button', { name: "It's right" })).toBeNull()
  },
}

/** A chord spot: the guess dashed with "?", how often a guess like it is wrong, and the other
 * likely chords as frequencies. Two taps from the spot to an alternative playing over the loop
 * (27 §2): next spot, then Hear. */
export const ChordSpot: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { panel, dock } = await fixing(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Next unsure spot' }))
    await expect(await panel.findByRole('heading', { name: 'Spot 2 of 3 · bar 7–8' })).toBeVisible()
    const card = within(panel.getByRole('region', { name: 'Bar 7 · chord' }))
    await expect(
      card.getByText(/^Our first guess\. Wrong about 1 time in 2 for bars like this\.$/),
    ).toBeVisible()
    const rows = card.getAllByRole('listitem')
    await expect(rows[0]).toHaveTextContent(/Em.*about 1 in 3/)
    await expect(rows[1]).toHaveTextContent(/G7.*about 1 in 5/)
    await expect(dock.getByText('Bars 7–8')).toBeVisible()
    const hear = card.getByRole('button', { name: 'Hear Em over the loop' })
    await userEvent.click(hear)
    await expect(hear).toHaveAttribute('aria-pressed', 'true')
    await expect(await dock.findByRole('button', { name: 'Pause' })).toBeVisible()
    await userEvent.click(dock.getByRole('button', { name: 'Pause' }))
  },
}

/** Keys only (27 §2): J to the next spot puts focus on its first action, Enter hears the
 * alternative, Tab and Enter use it; K goes back, Esc leaves. */
export const KeysOnly: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { canvas, panel, dock, body } = await fixing(canvasElement)
    await press('j')
    await expect(await panel.findByRole('heading', { name: 'Spot 2 of 3 · bar 7–8' })).toBeVisible()
    const hear = panel.getByRole('button', { name: 'Hear Em over the loop' })
    await waitFor(() => expect(hear).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await expect(hear).toHaveAttribute('aria-pressed', 'true')
    await expect(await dock.findByRole('button', { name: 'Pause' })).toBeVisible()
    await userEvent.tab()
    await expect(panel.getByRole('button', { name: 'Use Em' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(await body.findByText('Edit saved · bar 7, G → Em')).toBeVisible()
    // The chord is no longer a spot: from outside the queue K goes to its last one.
    await press('k')
    await expect(await panel.findByRole('heading', { name: 'Spot 2 of 2 · bar 3–4' })).toBeVisible()
    await press('{Escape}')
    await waitFor(() => expect(canvas.queryByText(m['fix.fixing']())).toBeNull())
    await expect(canvas.getByRole('tab', { name: 'Loop' })).toHaveAttribute('aria-selected', 'true')
  },
}

/** From practice by key (12 §8): J enters Fix mode on the first spot with focus on its first
 * action, so Enter confirms it; nothing was open before. */
export const EnterByKey: Story = {
  render: screen(FIX, { tab: 'loop' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeEnabled(), {
      timeout: 20_000,
    })
    await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await press('j')
    const panel = within(await canvas.findByRole('tabpanel'))
    await expect(
      await panel.findByRole('heading', { name: 'Spot 1 of 3 · bar 4' }, { timeout: 20_000 }),
    ).toBeVisible()
    // The unsure F of the same bar has its own card: the note's action is the one focused.
    const note = within(panel.getByRole('region', { name: 'Bar 4 · note 2' }))
    await waitFor(() => expect(note.getByRole('button', { name: "It's right" })).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await expect(
      await within(canvasElement.ownerDocument.body).findByText('Edit saved · bar 4'),
    ).toBeVisible()
  },
}

/** A shaky bar (26 §5): one spot for the bar, which can be confirmed whole. */
export const ShakyBar: Story = {
  render: screen({ notes: FIX_NOTES_SHAKY }),
  play: async ({ canvasElement }) => {
    const { canvas, panel, body } = await fixing(canvasElement)
    await expect(panel.getByRole('heading', { name: 'Spot 1 of 2 · bar 7' })).toBeVisible()
    const card = within(panel.getByRole('region', { name: 'Bar 7 · notes' }))
    await expect(
      card.getByText(/^Most notes in this bar are unsure\. Wrong about 1 time in \d+\.$/),
    ).toBeVisible()
    await userEvent.click(card.getByRole('button', { name: "It's right" }))
    await expect(await body.findByText('Edit saved · bar 7')).toBeVisible()
    await waitFor(() => expect(canvas.getByRole('tab', { name: /^Fix/ })).toHaveTextContent('1'))
  },
}

/** A beat fix (12 §4, §10): the song is re-barred in the browser within 300 ms and a line says
 * what that did, with Undo. */
export const BeatFix: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { panel } = await fixing(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Half tempo' }))
    const line = await panel.findByRole('status')
    await expect(line).toHaveTextContent(/^Re-barred \d+ bars/)
    await expect(Number(line.getAttribute('data-requantize-ms'))).toBeLessThanOrEqual(300)
    await userEvent.click(within(line).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(panel.queryByRole('status')).toBeNull())
  },
}

/** After Use: the chord is the learner's (underlined "Edited by you", never colour alone), the
 * toast names the change, and Your edits lists it with Revert, which puts the guess back. */
export const AfterUse: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { panel, body } = await fixing(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Next unsure spot' }))
    const card = within(await panel.findByRole('region', { name: 'Bar 7 · chord' }))
    await userEvent.click(card.getByRole('button', { name: 'Use Em' }))
    await expect(await body.findByText('Edit saved · bar 7, G → Em')).toBeVisible()
    await expect(await card.findByText(m['practice.edited']())).toBeVisible()
    const edits = within(await panel.findByRole('region', { name: 'Your edits' }))
    await expect(edits.getByText('Changed a chord · bar 7 · G → Em')).toBeVisible()
    await expect(edits.getByText(m['practice.fix_saved_note']())).toBeVisible()
    await userEvent.click(edits.getByRole('button', { name: 'Revert' }))
    await expect(await edits.findByText('Changed a chord · bar 7 · Em → G')).toBeVisible()
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot=chord-guess]')).toHaveTextContent(/^G/),
    )
  },
}

/** Offline (27 §4): an edit waits on this device; the toast and its row say so. */
export const OfflineQueued: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { panel, body } = await fixing(canvasElement)
    useCorrections.setState({ offline: true })
    const card = within(panel.getByRole('region', { name: 'Bar 4 · note 2' }))
    await userEvent.click(card.getByRole('button', { name: 'Fret up' }))
    await expect(
      await body.findByText('Saved on this device · bar 4, string 5 → fret 4'),
    ).toBeVisible()
    // The tab is redrawn with the new fret within 150 ms of the edit (12 §10).
    const notation = canvasElement.querySelector('[data-slot=notation]') as HTMLElement
    await waitFor(() =>
      expect(within(notation).getByRole('button', { name: /fret 4$/ })).toBeVisible(),
    )
    await expect(Number(notation.getAttribute('data-update-ms'))).toBeLessThanOrEqual(150)
    const edits = within(await panel.findByRole('region', { name: 'Your edits' }))
    await expect(await edits.findByText('Saved on this device')).toBeVisible()
    await expect(edits.getByText('Changed a note · bar 4')).toBeVisible()
  },
}

/** Edits from an earlier visit (the server's): listed with when, each with Revert; Show original
 * shows the transcription without them. */
export const SavedEdits: Story = {
  render: screen({
    chords: FIX_CHORDS,
    corrections: { chords: [{ op: 'set_chord', segment_id: 'c0001', label: 'A:min7' }] },
  }),
  play: async ({ canvasElement }) => {
    const { panel } = await fixing(canvasElement)
    const edits = within(panel.getByRole('region', { name: 'Your edits' }))
    await expect(edits.getByText('Changed a chord · bar 1 · Am → Am7')).toBeVisible()
    await expect(edits.getByRole('button', { name: 'Revert' })).toBeVisible()
    await userEvent.click(edits.getByRole('switch', { name: 'Show original' }))
    await expect(await panel.findByText(m['fix.showing_original']())).toBeVisible()
    await expect(edits.queryByRole('button', { name: 'Revert' })).toBeNull()
    await userEvent.click(edits.getByRole('switch', { name: 'Show original' }))
    await expect(await panel.findByRole('region', { name: 'Bar 4 · note 2' })).toBeVisible()
  },
}

/** Replace all in this song (12 §4): after a change, the other bars with the chord it had can
 * take the same change in one go, with one Undo. */
export const ReplaceAll: Story = {
  render: screen({ chords: FIX_CHORDS_REPEAT }),
  play: async ({ canvasElement }) => {
    const { panel, body } = await fixing(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Next unsure spot' }))
    const card = within(await panel.findByRole('region', { name: 'Bar 7 · chord' }))
    await userEvent.click(card.getByRole('button', { name: 'Use Em' }))
    await expect(
      await card.findByText('Every other G in this song becomes Em too (1).'),
    ).toBeVisible()
    await userEvent.click(card.getByRole('button', { name: 'Replace all in this song' }))
    // The first edit couldn't be sent here, so this one may say where it is kept.
    await expect(await body.findByText(/G → Em, and 1 more in this song$/)).toBeVisible()
    const edits = within(await panel.findByRole('region', { name: 'Your edits' }))
    await expect(edits.getByText('Changed a chord · bar 3 · G → Em')).toBeVisible()
  },
}

/** Well over 99 spots: the badge caps at 99+, the header counts them all, J still steps. */
export const ManySpots: Story = {
  render: screen({ notes: FIX_NOTES_MANY }),
  play: async ({ canvasElement }) => {
    const { canvas, panel } = await fixing(canvasElement)
    await expect(canvas.getByRole('tab', { name: /^Fix/ })).toHaveTextContent('99+')
    await expect(panel.getByRole('heading', { name: /^Spot 1 of 128 · bar/ })).toBeVisible()
    await press('j')
    await expect(await panel.findByRole('heading', { name: /^Spot 2 of 128 · bar/ })).toBeVisible()
  },
}

/** Long chord names (F♯m7♭5 and its neighbours): the rows keep their Hear and Use inside the
 * card. */
export const LongChordNames: Story = {
  render: screen({ chords: FIX_CHORDS_LONG, notes: FIX_NOTES_SURE }),
  play: async ({ canvasElement }) => {
    const { panel } = await fixing(canvasElement)
    const card = panel.getByRole('region', { name: 'Bar 7 · chord' })
    await expect(within(card).getByRole('button', { name: 'Use F♯m7' })).toBeVisible()
    const cardBox = card.getBoundingClientRect()
    for (const row of within(card).getAllByRole('listitem')) {
      const use = within(row).getByRole('button', { name: /^Use / })
      await expect(use.getBoundingClientRect().right).toBeLessThanOrEqual(cardBox.right)
    }
  },
}

/** Listen to (27 §3.7.4): Original · Your part · Tab synth · Both, one always chosen. */
export const ListenTo: Story = {
  render: screen(),
  play: async ({ canvasElement }) => {
    const { dock } = await fixing(canvasElement)
    const listen = within(dock.getByRole('group', { name: 'Listen to' }))
    await expect(listen.getByRole('button', { name: 'Original' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const name of ['Your part', 'Both', 'Tab synth']) {
      await userEvent.click(listen.getByRole('button', { name }))
      await expect(listen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
    }
    await userEvent.click(dock.getByRole('button', { name: 'Play bar 4' }))
    await expect(await dock.findByRole('button', { name: 'Pause' })).toBeVisible()
    await userEvent.click(dock.getByRole('button', { name: 'Pause' }))
  },
}

/** Fix-mode targets (26 §8, V11): Play and speed − / + 64, Listen to items 48, nothing in the tab
 * under 44. */
export const Targets: Story = {
  render: screen(),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const { canvas, panel, dock } = await fixing(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Next unsure spot' }))
    await panel.findByRole('region', { name: 'Bar 7 · chord' })
    for (const name of [/^Play bars 7 to 8$/, /^Slower/, /^Faster/]) {
      await atLeast(dock.getByRole('button', { name }), 64)
    }
    for (const item of within(dock.getByRole('group', { name: 'Listen to' })).getAllByRole(
      'button',
    )) {
      await expect(Math.round(item.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48)
    }
    const controls = [
      ...panel.getAllByRole('button'),
      canvas.getByRole('button', { name: m['fix.done']() }),
      canvas.getByRole('button', { name: m['editor.undo']() }),
    ]
    for (const control of controls) {
      await expect(Math.round(control.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    }
  },
}

/** Done hands the player back as it was: the learner's loop and speed, the tab used before. */
export const Done: Story = {
  render: screen(FIX, { tab: 'fix', loop: '5-6', speed: 80 }),
  play: async ({ canvasElement }) => {
    const { canvas, dock } = await fixing(canvasElement)
    await userEvent.click(dock.getByRole('button', { name: /^Slower/ }))
    await expect(dock.getByText(/^75\s%$/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: m['fix.done']() }))
    const transport = within(await canvas.findByRole('toolbar', { name: 'Playback' }))
    await expect(await transport.findByRole('button', { name: /^Loop · bars 5–6/ })).toBeVisible()
    // The readout counts back up to the practice speed.
    await waitFor(() =>
      expect(transport.getByRole('button', { name: /^Speed: 80/ })).toHaveTextContent(/80\s%/),
    )
    await expect(canvas.queryByText(m['fix.fixing']())).toBeNull()
  },
}

/** Practice-Fix.dc.html at 1440. */
export const Wide: Story = {
  render: screen(),
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const { panel } = await fixing(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Next unsure spot' }))
    await expect(await panel.findByRole('region', { name: 'Bar 7 · chord' })).toBeVisible()
  },
}

/** At 1180 the inspector is still docked and the pill keeps its words. */
export const At1180: Story = {
  ...Wide,
  globals: { viewport: { value: 'desktop1180' } },
}

export const Daylight: Story = { ...Wide, globals: { appearance: 'light' } }

export const Daylight1440: Story = {
  ...Wide,
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
}

export const IncreasedContrast: Story = { ...Wide, globals: { contrast: 'more' } }

export const DaylightIncreasedContrast: Story = {
  ...Wide,
  globals: { appearance: 'light', contrast: 'more' },
}

/** The desktop editor (27 §3.8): Fix mode on a page of its own, from the same components. */
export const Editor: Story = {
  render: () => (
    <Toaster closeLabel={m['system.close']()}>
      <AppStory path={`/songs/${SONG_ID}/edit`} seed={seed(ALL, FIX)}>
        <EditPage songId={SONG_ID} fetchAudio={tone} />
      </AppStory>
    </Toaster>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const inspector = within(
      await canvas.findByRole(
        'complementary',
        { name: 'Bar and note details' },
        { timeout: 20_000 },
      ),
    )
    await expect(
      await inspector.findByRole('heading', { name: 'Spot 1 of 3 · bar 4' }, { timeout: 20_000 }),
    ).toBeVisible()
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    await waitFor(() => expect(tab).toBeVisible())
    // The bars are drawn (the tab's own keyboard targets) before anything is checked.
    await waitFor(() => expect(tab.querySelector('[data-slot=bar-target]')).not.toBeNull(), {
      timeout: 20_000,
    })
    await expect(canvas.getByRole('button', { name: m['fix.hear_original']() })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: m['editor.redo']() })).toBeDisabled()
    await expect(canvas.getByRole('toolbar', { name: 'Playback' })).toBeVisible()
    await press('j')
    await expect(
      await inspector.findByRole('heading', { name: 'Spot 2 of 3 · bar 7–8' }),
    ).toBeVisible()
  },
}

export const EditorDaylight: Story = { ...Editor, globals: { appearance: 'light' } }
