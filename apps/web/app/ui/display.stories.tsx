import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoreHorizontalIcon } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { Button } from './button.tsx'
import { Kbd, KbdGroup } from './kbd.tsx'
import { ListGroup, ListRow } from './list-row.tsx'
import { Meter, MeterLabel, MeterValue } from './meter.tsx'
import { Panel, PanelBody, PanelHeader, PanelSection, PanelTitle } from './panel.tsx'
import { Progress, ProgressLabel, ProgressValue } from './progress.tsx'
import { ScrollArea } from './scroll-area.tsx'
import { Separator } from './separator.tsx'
import { Skeleton } from './skeleton.tsx'
import { Spinner } from './spinner.tsx'
import { Status, type StatusKind } from './status.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  isClear,
  resolve,
  StateGrid,
  shadowsOf,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'

// Doc 26 §12.1–§12.2, s47 direction §4: status is a glyph and words (no tinted badge); key caps
// sit beside actions; progress is the ink on a hairline track; rows are hairline rows with no card
// around them; skeletons are the --panel well. Nothing here casts a shadow.
const BARS = Array.from({ length: 40 }, (_, index) => index + 1)

const meta = { title: 'Base/Display' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const STATUSES: [StatusKind, string][] = [
  ['ready', 'Ready'],
  ['working', 'Separating stems · 62 %'],
  ['queued', 'Queued'],
  ['attention', '6 unsure spots'],
  ['failed', 'Upload failed'],
  ['partial', 'Lite: chords only'],
]

const StatusesDemo = () => (
  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
    {STATUSES.map(([kind, words]) => (
      <Status key={kind} kind={kind} {...(kind === 'working' ? { progress: 0.62 } : {})}>
        {words}
      </Status>
    ))}
  </div>
)

/**
 * What took the badge's place: a glyph and words, with no pill and no tint. Every state has its own
 * glyph shape, and the words are text at ≥ 4.5:1 on the page.
 */
export const Statuses: Story = {
  render: StatusesDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const statuses = [...frame.querySelectorAll<HTMLElement>('[data-slot=status]')]
      await expect(statuses).toHaveLength(STATUSES.length)
      for (const status of statuses) {
        await expect(isClear(getComputedStyle(status).backgroundColor)).toBe(true)
        await expect(status.querySelector('svg')).not.toBeNull()
        await expect(
          contrast(getComputedStyle(status).color, surfaceOf(frame)),
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  },
}

const KbdDemo = () => (
  <div className="flex flex-col gap-3">
    <KbdGroup>
      <Kbd>Space</Kbd>
      <Kbd>C</Kbd>
      <Kbd>N</Kbd>
      <Kbd>Ctrl K</Kbd>
      <Kbd>⌘ K</Kbd>
      <Kbd>⇧ ←</Kbd>
      <Kbd>⌥ ↵</Kbd>
    </KbdGroup>
    <p className="text-body-sm text-muted-foreground">
      Press <Kbd>Space</Kbd> to play,{' '}
      <KbdGroup>
        <Kbd>⇧</Kbd>
        <Kbd>←</Kbd>
      </KbdGroup>{' '}
      to move the loop back by its own length.
    </p>
  </div>
)

/**
 * `.kbd`: 11 px JetBrains Mono (it has ⌘ ⇧ ⌥ ↵), 20 px tall, a flat 1 px --border-strong edge and
 * no fill, so a key cap reads as a label and not as a second button.
 */
export const Keys: Story = {
  render: KbdDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const key = within(frame).getByText('⌘ K')
      const style = getComputedStyle(key)
      await expect(style.fontFamily).toMatch(/^"?JetBrains Mono/)
      await expect(style.fontSize).toBe('11px')
      await expect(key.getBoundingClientRect().height).toBe(20)
      await expect(style.borderBottomWidth).toBe('1px')
      await expect(isClear(style.backgroundColor)).toBe(true)
      await expect(shadowsOf(key)).toEqual([])
      await expect(contrast(style.color, surfaceOf(frame))).toBeGreaterThanOrEqual(4.5)
    }
  },
}

const ProgressesDemo = () => (
  <div className="flex max-w-md flex-col gap-6">
    <Progress value={62} getAriaValueText={() => 'Separating stems, 62 %'}>
      <ProgressLabel>Separating stems</ProgressLabel>
      <ProgressValue />
    </Progress>
    <Progress value={null} getAriaValueText={() => 'Waiting for the processing machine'}>
      <ProgressLabel>Waiting</ProgressLabel>
    </Progress>
    <Meter value={3} min={0} max={5} getAriaValueText={() => '3 of 5 Lite analyses left'}>
      <MeterLabel>Lite analyses</MeterLabel>
      <MeterValue>{() => '3 of 5'}</MeterValue>
    </Meter>
  </div>
)

/**
 * `.bar`: a 6 px pill track in the hairline grey filled with the ink (≥ 3:1 on the page); the stage
 * is named in aria-valuetext. A meter is muted, because it measures rather than progresses.
 */
export const Progresses: Story = {
  render: ProgressesDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const [bar, waiting] = within(frame).getAllByRole('progressbar') as [HTMLElement, HTMLElement]
      await expect(bar).toHaveAttribute('aria-valuetext', 'Separating stems, 62 %')
      await expect(waiting).toHaveAttribute('aria-valuetext', 'Waiting for the processing machine')
      const track = bar.querySelector('[data-slot="progress-track"]') as HTMLElement
      const fill = bar.querySelector('[data-slot="progress-indicator"]') as HTMLElement
      await expect(track.getBoundingClientRect().height).toBe(6)
      await expect(getComputedStyle(fill).backgroundColor).toBe(
        resolve(fill, 'backgroundColor', '--signal'),
      )
      await expect(
        contrast(getComputedStyle(fill).backgroundColor, surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
      // The value is in tabular figures, so it never jumps as it counts.
      const value = bar.querySelector('[data-slot="progress-value"]') as HTMLElement
      await expect(getComputedStyle(value).fontVariantNumeric).toBe('tabular-nums')
      const meter = within(frame).getByRole('meter')
      const meterFill = meter.querySelector('[data-slot="meter-indicator"]') as HTMLElement
      await expect(getComputedStyle(meterFill).backgroundColor).toBe(
        resolve(meterFill, 'backgroundColor', '--muted-foreground'),
      )
    }
  },
}

/** Progress inside a hairline row (what replaced a progress card): the same 6 px track. */
export const ProgressInRow: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <ListGroup title="Getting ready" count={1} className="max-w-md">
      <ListRow
        title="Walking bass in F"
        meta={
          <Progress value={40} getAriaValueText={() => 'Finding chords, 40 %'} className="mt-1">
            <ProgressLabel className="sr-only">Finding chords</ProgressLabel>
          </Progress>
        }
        aside={
          <Status kind="working" progress={0.4}>
            Finding chords
          </Status>
        }
      />
    </ListGroup>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const row = frame.querySelector('[data-slot=list-row]') as HTMLElement
      const track = row.querySelector('[data-slot="progress-track"]') as HTMLElement
      await expect(track.getBoundingClientRect().height).toBe(6)
      // A row, not a card: a bottom hairline, no fill and no shadow.
      await expect(getComputedStyle(row).borderBottomWidth).toBe('1px')
      await expect(isClear(getComputedStyle(row).backgroundColor)).toBe(true)
      await expect(shadowsOf(row)).toEqual([])
    }
  },
}

/** Skeletons mirror the content they stand for (a title line, two text lines, a row). */
export const Loading: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <div className="flex max-w-md flex-col gap-3" aria-busy="true">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-14 w-full" />
      <span className="inline-flex items-center gap-2 text-body-sm text-muted-foreground">
        <Spinner />
        Loading your song…
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const skeleton = frame.querySelector('[data-slot=skeleton]') as HTMLElement
      await expect(skeleton).toHaveAttribute('aria-hidden', 'true')
      await expect(getComputedStyle(skeleton).borderTopLeftRadius).toBe('10px')
      await expect(getComputedStyle(skeleton).backgroundImage).toContain('gradient')
      // The spinner is decorative beside its words, which carry the state.
      const spinner = frame.querySelector('[data-slot=spinner]') as SVGElement
      await expect(spinner).toHaveAttribute('aria-hidden', 'true')
      await expect(within(frame).getByText('Loading your song…')).toBeVisible()
    }
  },
}

/** Under reduced motion the skeleton sweep and the spinner stop. */
export const LoadingReducedMotion: Story = {
  ...Loading,
  globals: { appearance: 'side-by-side', motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector('[data-slot=skeleton]') as HTMLElement
    await expect(getComputedStyle(skeleton).animationDuration).toBe('0s')
    const spinner = canvasElement.querySelector('[data-slot=spinner]') as SVGElement
    await expect(getComputedStyle(spinner).animationDuration).toBe('0s')
  },
}

const RowsDemo = () => (
  <ListGroup title="Ready to practise" count={2} className="max-w-xl">
    <ListRow
      render={<a href="#riff" />}
      title="Riff in A minor"
      meta="Guitar · A minor · 100 BPM · 3:34"
      aside={
        <>
          <Status kind="ready">Best clean 85 %</Status>
          <Button variant="quiet" size="icon-sm" aria-label="More for Riff in A minor">
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </>
      }
    />
    <ListRow
      render={<a href="#plus" />}
      title="Plus"
      meta="Full analyses with your part isolated, plus tab"
      aside={<span className="text-caption text-muted-foreground">Demo mode, no real charges</span>}
    />
  </ListGroup>
)

/** What replaced cards: hairline rows under a quiet group head, with no box around them. */
export const Rows: Story = {
  render: RowsDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const group = frame.querySelector('[data-slot=list-group]') as HTMLElement
      await expect(getComputedStyle(group).borderTopWidth).toBe('0px')
      await expect(isClear(getComputedStyle(group).backgroundColor)).toBe(true)
      for (const row of frame.querySelectorAll<HTMLElement>('[data-slot=list-row]')) {
        await expect(getComputedStyle(row).borderBottomWidth).toBe('1px')
        await expect(getComputedStyle(row).borderTopLeftRadius).toBe('0px')
        await expect(shadowsOf(row)).toEqual([])
      }
    }
  },
}

/** A titled block of content sits in the one Panel, not in a card: a hairline divides sections. */
export const PanelSections: Story = {
  render: () => (
    <div className="flex h-80 border border-border">
      <div className="flex-1" />
      <Panel aria-label="Plan">
        <PanelHeader>
          <PanelTitle>Plus</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <PanelSection title="What you get">
            <p className="text-body-sm">Full analyses with your part isolated, plus tab.</p>
          </PanelSection>
          <PanelSection title="Billing">
            <p className="text-body-sm text-muted-foreground">Demo mode, no real charges.</p>
          </PanelSection>
        </PanelBody>
      </Panel>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('complementary', { name: 'Plan' })
    await expect(shadowsOf(panel)).toEqual([])
    const [first, second] = panel.querySelectorAll<HTMLElement>(
      '[data-slot=panel-section]',
    ) as unknown as [HTMLElement, HTMLElement]
    await expect(getComputedStyle(first).borderTopWidth).toBe('0px')
    await expect(getComputedStyle(second).borderTopWidth).toBe('1px')
  },
}

export const Scrolling: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <div className="flex items-stretch gap-4">
      <ScrollArea
        className="h-48 w-72 rounded-field border border-border"
        tabIndex={0}
        aria-label="Bars"
      >
        <ol className="p-4">
          {BARS.map((bar) => (
            <li key={bar} className="py-1 text-body tabular-nums">
              Bar {bar}
            </li>
          ))}
        </ol>
      </ScrollArea>
      <Separator orientation="vertical" />
      <div className="flex w-40 flex-col gap-3 text-body-sm">
        Above
        <Separator />
        Below
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const viewport = frame.querySelector('[data-slot=scroll-area-viewport]') as HTMLElement
      await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)
      const [vertical, horizontal] = frame.querySelectorAll<HTMLElement>('[data-slot=separator]')
      await expect(vertical?.getBoundingClientRect().width).toBe(1)
      await expect(horizontal?.getBoundingClientRect().height).toBe(1)
    }
  },
}

const Gallery = () => (
  <StateGrid
    className="flex flex-col gap-6"
    states={[
      ['Statuses', <StatusesDemo key="b" />],
      ['Keys', <KbdDemo key="k" />],
      ['Progress and meter', <ProgressesDemo key="p" />],
      ['Rows', <RowsDemo key="c" />],
      [
        'Spinner and skeleton',
        <div key="s" className="flex w-72 items-center gap-3">
          <Spinner />
          <Skeleton className="h-4 flex-1" />
        </div>,
      ],
    ]}
  />
)

export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
