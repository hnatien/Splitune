import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import {
  type Beats,
  buildTab,
  type Chords,
  chordShapes,
  confidenceBand,
  type Notes,
} from '@splitune/music-core'
import {
  type BarTimes,
  ChordDiagram,
  FretboardDiagram,
  type FretboardDiagramProps,
  KeyboardDiagram,
  type NoteMark,
} from '@splitune/notation'
import { AlphaTabView } from '@splitune/notation/view'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { useScoreTheme } from '../features/practice/score-theme.ts'

// packages/notation (12 §3, 26 §5, §12.2): the alphaTab view with the confidence overlay, loop
// shading, the current bar and the bar targets, on the contracts' 8-bar fixture; the chord diagram
// in both hands. The clock stands still at bar 4, beat 2.
const meta = { title: 'Kit/Notation', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const built = buildTab(notes as Notes, beats as Beats, {}, { chords: chords as Chords })
const MARKS = new Map<string, NoteMark>(
  (notes as Notes).notes.map((note) => [note.id, { level: confidenceBand(note.confidence) }]),
)
const TIMES: BarTimes = {
  firstBar: built.alphaTexFirstBar,
  beatsOf: (bar) => [0, 1, 2, 3].map((beat) => 0.5 + bar * 2.4 + beat * 0.6),
}
const CLOCK = { position: () => 8.4, playing: () => false }

function Score(props: {
  showUncertainty?: boolean
  loop?: { startBar: number; endBar: number } | null
  armedBar?: number | null
  layout?: 'page' | 'scroll'
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const theme = useScoreTheme(host)
  return (
    <div ref={setHost} className="flex h-[32rem] flex-col">
      {theme && (
        <AlphaTabView
          className="min-h-0 flex-1"
          tex={built.alphaTex}
          noteMap={built.noteMap}
          marks={MARKS}
          times={TIMES}
          theme={theme}
          layout={props.layout ?? 'page'}
          clock={CLOCK}
          media={{ duration: () => 20.5 }}
          showUncertainty={props.showUncertainty ?? true}
          loop={props.loop ?? null}
          armedBar={props.armedBar ?? null}
          interaction="bars"
          barLabel={(bar) => `Bar ${bar + 1}`}
          labels={{
            octaveUp: 'Played an octave higher than recorded',
            octaveDown: 'Played an octave lower than recorded',
            region: 'Tab',
          }}
          onBarActivate={fn()}
        />
      )}
    </div>
  )
}

const rendered = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getAllByRole('button', { name: /^Bar \d$/ }).length).toBe(9), {
    timeout: 15_000,
  })
  return canvas
}

export const Default: Story = {
  render: () => <Score />,
  play: async ({ canvasElement }) => {
    await rendered(canvasElement)
    // Medium and low notes carry dashed outlines; low ones the "?" glyph (26 §5).
    await expect(canvasElement.querySelectorAll('[data-slot=note-mark]').length).toBeGreaterThan(0)
  },
}

/** "Show uncertainty" off: the ink stays, the outlines and glyphs go. */
export const UncertaintyHidden: Story = {
  render: () => <Score showUncertainty={false} />,
  play: async ({ canvasElement }) => {
    await rendered(canvasElement)
    await expect(canvasElement.querySelectorAll('[data-slot=note-mark]').length).toBe(0)
  },
}

export const Loop: Story = {
  render: () => <Score loop={{ startBar: 2, endBar: 3 }} />,
  play: async ({ canvasElement }) => {
    const canvas = await rendered(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Bar 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

/** Bar A tapped, waiting for bar B (dashed shading). */
export const Armed: Story = { render: () => <Score armedBar={4} /> }

export const Scrolling: Story = { render: () => <Score layout="scroll" /> }

/** Dark keeps the score on paper by default (26 §2). */
export const Dark: Story = {
  render: () => <Score loop={{ startBar: 2, endBar: 3 }} />,
  globals: { appearance: 'dark' },
}

/** Dark with Score: Match appearance — Stage's score colours at the normal size. */
export const MatchDark: Story = {
  render: () => <Score loop={{ startBar: 2, endBar: 3 }} />,
  globals: { appearance: 'dark', score: 'match' },
}

export const StageScore: Story = {
  render: () => <Score loop={{ startBar: 2, endBar: 3 }} />,
  globals: { appearance: 'stage' },
}

const AM = chordShapes('A:min')[0]?.frets ?? []
const BM = chordShapes('B:min').find((shape) => shape.kind === 'barre')?.frets ?? []

export const Diagrams: Story = {
  render: () => (
    <div className="flex gap-8 bg-paper p-6 text-ink">
      <ChordDiagram className="h-28 w-24" frets={AM} label="Am chord shape" />
      <ChordDiagram className="h-28 w-24" frets={AM} label="Am chord shape, left-handed" mirrored />
      <ChordDiagram className="h-28 w-24" frets={BM} label="Bm barre chord shape" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Am chord shape, left-handed' })).toHaveAttribute(
      'data-mirrored',
      'true',
    )
  },
}

/** Piano keyboard (V13): E♭maj7 with the bass in the left hand and G B♭ D in the right, L and R on
 * the keys, middle C labelled; the same chord with the right hand only; an empty keyboard (N.C.). */
export const Keyboards: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-paper p-6 text-ink">
      <KeyboardDiagram
        className="h-28 w-auto"
        left={[39]}
        right={[55, 58, 62]}
        label="E♭maj7: left hand E♭, right hand G B♭ D"
        middleC="C4"
      />
      <KeyboardDiagram
        className="h-16 w-auto"
        left={[]}
        right={[56, 61, 65]}
        label="B♭m7: right hand A♭ D♭ F"
        marks={false}
      />
      <KeyboardDiagram className="h-16 w-auto" left={[]} right={[]} label="No chord" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const keys = canvas.getByRole('img', { name: /^E♭maj7/ })
    const pressed = [...keys.querySelectorAll('[data-hand]')].map((key) => [
      key.getAttribute('data-midi'),
      key.getAttribute('data-hand'),
    ])
    await expect(pressed).toEqual([
      ['55', 'right'],
      ['62', 'right'],
      ['39', 'left'],
      ['58', 'right'],
    ])
    await expect(within(keys).getAllByText('R')).toHaveLength(3)
    await expect(within(keys).getByText('L')).toBeVisible()
    await expect(
      canvas.getByRole('img', { name: 'No chord' }).querySelectorAll('[data-hand]'),
    ).toHaveLength(0)
  },
}

const GUITAR = ['e', 'B', 'G', 'D', 'A', 'E']
const neck = (props: Partial<FretboardDiagramProps> & Pick<FretboardDiagramProps, 'label'>) => (
  <FretboardDiagram
    names={GUITAR}
    window={{ lo: 1, hi: 5 }}
    width={420}
    height={300}
    readPx={28}
    numberPx={16}
    sounding={[]}
    next={[]}
    accent="var(--fret-guitar)"
    {...props}
  />
)

/** Fretboard (step 18b), the neck beside guitar's Notes lanes: Fmaj7 sounding in open position with
 * the next shape (C) ghosted; up the neck at the 7th fret with a cue to the 12th; the same mirrored
 * for a left-handed player; a capo on the 2nd fret; a 5-string bass. */
export const Fretboards: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6 bg-paper p-6 font-reading text-ink">
      {neck({
        label: 'Open position: Fmaj7 sounding, C next',
        sounding: [
          { string: 1, fret: 0, landed: true },
          { string: 2, fret: 1, landed: true },
          { string: 3, fret: 2, landed: true },
          { string: 4, fret: 3, landed: true },
        ],
        next: [
          { string: 5, fret: 3 },
          { string: 4, fret: 2 },
          { string: 2, fret: 1 },
        ],
        landing: 1,
      })}
      {neck({
        label: 'Seventh position, the 12th fret next',
        window: { lo: 7, hi: 11 },
        sounding: [{ string: 1, fret: 7 }],
        next: [{ string: 1, fret: 12 }],
        shift: { fret: 12, label: 'Fret 12' },
      })}
      {neck({
        label: 'Left-handed: seventh position, the 12th fret next',
        window: { lo: 7, hi: 11 },
        sounding: [{ string: 1, fret: 7 }],
        shift: { fret: 12, label: 'Fret 12' },
        mirrored: true,
      })}
      {neck({
        label: 'Capo on the 2nd fret: Am shape',
        capo: 2,
        sounding: [
          { string: 2, fret: 1 },
          { string: 3, fret: 2 },
          { string: 4, fret: 2 },
          { string: 5, fret: 0 },
        ],
      })}
      {neck({
        label: 'Five-string bass: low B, fret 3',
        names: ['G', 'D', 'A', 'E', 'B'],
        accent: 'var(--fret-bass)',
        sounding: [{ string: 5, fret: 3 }],
        next: [{ string: 4, fret: 5 }],
      })}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const open = canvas.getByRole('img', { name: /^Open position/ })
    await expect(open.querySelectorAll('[data-slot=fret-now]')).toHaveLength(4)
    // The strum that just landed rings once.
    await expect(open.querySelectorAll('[data-slot=fret-ring]')).toHaveLength(4)
    // The next shape's B-string 1st fret is already held: only the new fingers are ghosted.
    await expect(open.querySelectorAll('[data-slot=fret-next]')).toHaveLength(2)
    const up = canvas.getByRole('img', { name: /^Seventh position/ })
    await expect(up.querySelector('[data-slot=fret-shift]')).toHaveTextContent('Fret 12 →')
    // The 12th fret is outside the window: no ghost for it, the cue instead.
    await expect(up.querySelectorAll('[data-slot=fret-next]')).toHaveLength(0)
    const left = canvas.getByRole('img', { name: /^Left-handed/ })
    await expect(left).toHaveAttribute('data-mirrored', 'true')
    await expect(left.querySelector('[data-slot=fret-shift]')).toHaveTextContent('← Fret 12')
    await expect(canvas.getByRole('img', { name: /^Capo/ })).toHaveAttribute('data-capo', '2')
    const bass = canvas.getByRole('img', { name: /^Five-string/ })
    await expect([...bass.querySelectorAll('text')].slice(0, 5).map((t) => t.textContent)).toEqual([
      'G',
      'D',
      'A',
      'E',
      'B',
    ])
  },
}
