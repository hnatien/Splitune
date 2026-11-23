import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoreHorizontalIcon, MusicIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { ChoiceRow, ChoiceRowGroup } from './choice-row.tsx'
import { ListGroup, ListRow } from './list-row.tsx'
import { MusicStrip, stripColumns } from './music-strip.tsx'
import { Panel, PanelBody, PanelHeader, PanelSection, PanelTitle } from './panel.tsx'
import { Stat, Stats } from './stat.tsx'
import { Status, type StatusKind } from './status.tsx'
import { BOTH_THEMES, expectTargets, StateGrid, themeFrames } from './story-kit.tsx'

// The structural pieces of doc 26 §12.2: hairline rows instead of cards, a glyph and words
// instead of a tinted badge, one docked panel, and choices as rows marked by the ink edge.
const meta = { title: 'Base/Structure', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const LEVELS = Array.from({ length: 96 }, (_, i) => 0.25 + 0.7 * Math.abs(Math.sin(i * 0.37)))
const SECTIONS = [
  { start: 0, end: 0.12, label: 'Intro' },
  { start: 0.12, end: 0.45, label: 'Verse' },
  { start: 0.45, end: 0.8, label: 'Chorus' },
  { start: 0.8, end: 1, label: 'Outro' },
]

const STATUSES: [StatusKind, string][] = [
  ['ready', 'Ready'],
  ['working', 'Isolating your part · about 3 min'],
  ['queued', 'Queued'],
  ['attention', 'Rough tab'],
  ['failed', "Couldn't read this file"],
  ['partial', 'Chords only'],
  ['expired', 'Stems expired'],
  ['paused', 'Upload not finished'],
  ['offline', 'Processing machine offline'],
]

export const Statuses: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={STATUSES.map(([kind, words]) => [
        kind,
        <Status key={kind} kind={kind} {...(kind === 'working' ? { progress: 0.4 } : {})}>
          {words}
        </Status>,
      ])}
    />
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      // Each state has its own glyph, so no two states share a shape.
      const glyphs = [...frame.querySelectorAll('[data-slot=status] svg')].map((svg) =>
        svg.innerHTML.replace(/\s+/g, ' '),
      )
      await expect(new Set(glyphs).size).toBe(STATUSES.length)
      // The words carry the state too: every status has text.
      for (const status of frame.querySelectorAll('[data-slot=status]')) {
        await expect(status.textContent?.trim().length).toBeGreaterThan(0)
      }
    }
  },
}

function Rows() {
  return (
    <div className="mx-auto flex max-w-library flex-col gap-8">
      <ListGroup title="Getting ready" count={1}>
        <ListRow
          media={<MusicStrip sections={SECTIONS} />}
          title="Walking bass in F"
          meta="Bass · 3:34"
          aside={
            <Status kind="working" progress={0.35}>
              Isolating your part · about 3 min
            </Status>
          }
        />
      </ListGroup>
      <ListGroup title="Ready to practise" count={2}>
        <ListRow
          current
          render={<a href="#riff" />}
          media={<MusicStrip levels={LEVELS} sections={SECTIONS} progress={0.4} />}
          title="Riff in A minor"
          meta="Guitar · A minor · 100 BPM · 3:34"
          aside={
            <>
              <Status kind="ready">Best clean 85 %</Status>
              <Button variant="quiet" size="icon-sm" aria-label="More for Riff in A minor">
                <MoreHorizontalIcon />
              </Button>
            </>
          }
        />
        <ListRow
          render={<a href="#ballad" />}
          media={<MusicStrip levels={LEVELS} sections={SECTIONS} />}
          title="A very long song title that runs past the width of the row and has to be cut short"
          meta="Guitar · 3:34"
          aside={<Status kind="partial">Chords only</Status>}
        />
      </ListGroup>
    </div>
  )
}

export const ListRows: Story = {
  globals: BOTH_THEMES,
  render: Rows,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const link = canvas.getByRole('link', { name: /Riff in A minor/ })
      const row = link.closest('[data-slot=list-row]') as HTMLElement
      // The link's target is the whole row, and the row's own control stays reachable above it.
      const hit = getComputedStyle(link, '::after')
      await expect(hit.position).toBe('absolute')
      await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(56)
      await expectTargets([canvas.getByRole('button', { name: 'More for Riff in A minor' })])
      // Current is an ink edge, not a fill: the row keeps the page's background.
      await expect(row).toHaveAttribute('data-current')
      await expect(getComputedStyle(row, '::before').width).toBe('2px')
      // A long title is cut, never wrapped into the status.
      const long = canvas.getByText(/A very long song title/)
      await expect(long.scrollWidth).toBeGreaterThan(long.clientWidth)
    }
  },
}

function Choices() {
  const [level, setLevel] = useState('simplified')
  const [mix, setMix] = useState('loud')
  return (
    <div className="grid max-w-form gap-8">
      <ChoiceRowGroup aria-label="Level" value={level} onValueChange={(v) => setLevel(String(v))}>
        <ChoiceRow
          value="chords"
          icon={<MusicIcon />}
          label="Chords only"
          description="Strum along"
        />
        <ChoiceRow
          value="simplified"
          icon={<MusicIcon />}
          label="Simplified"
          description="The main notes of the part"
        />
        <ChoiceRow
          value="full"
          icon={<MusicIcon />}
          label="As played"
          description="Every note we heard"
          disabled
        />
      </ChoiceRowGroup>
      <ChoiceRowGroup aria-label="Mix" value={mix} onValueChange={(v) => setMix(String(v))}>
        <ChoiceRow size="sm" value="loud" label="Your part loud" />
        <ChoiceRow size="sm" value="minus" label="Minus one" />
        <ChoiceRow size="sm" value="original" label="Original" />
      </ChoiceRowGroup>
    </div>
  )
}

export const ChoiceRows: Story = {
  globals: BOTH_THEMES,
  render: Choices,
  play: async ({ canvasElement }) => {
    const frame = themeFrames(canvasElement)[0] as HTMLElement
    const canvas = within(frame)
    const simplified = canvas.getByRole('radio', { name: /Simplified/ })
    const chords = canvas.getByRole('radio', { name: /Chords only/ })
    await expect(simplified).toBeChecked()
    await expectTargets(canvas.getAllByRole('radio'))
    // Chosen is the 1.5 px ink edge plus a check; the row's surface does not change.
    const edge = (el: HTMLElement) => getComputedStyle(el).boxShadow
    await expect(edge(simplified)).toContain('1.5px')
    await expect(getComputedStyle(simplified).backgroundColor).toBe(
      getComputedStyle(chords).backgroundColor,
    )
    await userEvent.click(chords)
    await expect(chords).toBeChecked()
    await waitFor(() => expect(edge(chords)).toContain('1.5px'))
    await expect(canvas.getByRole('radio', { name: /As played/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

// One theme per story: a page has one panel, and two asides with one name are two landmarks.
export const DockedPanel: Story = {
  render: () => (
    <div className="flex h-96 border border-border">
      <div className="grid flex-1 place-items-center text-muted-foreground">The music</div>
      <Panel aria-label="Tools">
        <PanelHeader onClose={() => {}} closeLabel="Close tools" closeShortcut="Escape">
          <PanelTitle>Mix</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <PanelSection title="This week">
            <Stats>
              <Stat value="1 h 14" label="practised" />
              <Stat value="12" label="clean passes" />
            </Stats>
          </PanelSection>
          <PanelSection title="Presets">
            <ChoiceRowGroup aria-label="Mix" defaultValue="loud">
              <ChoiceRow size="sm" value="loud" label="Your part loud" />
              <ChoiceRow size="sm" value="minus" label="Minus one" />
            </ChoiceRowGroup>
          </PanelSection>
        </PanelBody>
      </Panel>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('complementary', { name: 'Tools' })
    // Docked, not floating: one hairline towards the content and no shadow.
    await expect(getComputedStyle(panel).boxShadow).toBe('none')
    await expect(getComputedStyle(panel).borderLeftWidth).toBe('1px')
    await expect(panel.getBoundingClientRect().width).toBe(340)
    await expectTargets([within(panel).getByRole('button', { name: 'Close tools' })])
  },
}
export const DockedPanelLight: Story = { ...DockedPanel, globals: { appearance: 'light' } }

export const MusicStrips: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={[
        ['Waveform and sections', <MusicStrip key="a" levels={LEVELS} sections={SECTIONS} />],
        [
          'Practised so far',
          <MusicStrip key="b" levels={LEVELS} sections={SECTIONS} progress={0.4} />,
        ],
        ['Sections only (no waveform yet)', <MusicStrip key="c" sections={SECTIONS} />],
        ['Labelled', <MusicStrip key="d" levels={LEVELS} label="Riff in A minor, 4 sections" />],
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(stripColumns([0.2, 1, 0.4, 0.1], 2)).toEqual([1, 0.4])
    await expect(stripColumns([], 4)).toEqual([])
    const frame = themeFrames(canvasElement)[0] as HTMLElement
    const strips = frame.querySelectorAll('[data-slot=music-strip]')
    await expect(strips[0]).toHaveAttribute('aria-hidden', 'true')
    await expect(within(frame).getByRole('img', { name: /Riff in A minor/ })).toBeVisible()
  },
}
