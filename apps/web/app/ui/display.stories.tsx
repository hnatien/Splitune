import type { Meta, StoryObj } from '@storybook/react-vite'
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { Badge } from './badge.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card.tsx'
import { Kbd, KbdGroup } from './kbd.tsx'
import { Meter, MeterLabel, MeterValue } from './meter.tsx'
import { Progress, ProgressLabel, ProgressValue } from './progress.tsx'
import { ScrollArea } from './scroll-area.tsx'
import { Separator } from './separator.tsx'
import { Skeleton } from './skeleton.tsx'
import { Spinner } from './spinner.tsx'
import { BOTH_THEMES, BOTH_THEMES_MORE_CONTRAST, StateGrid, themeFrames } from './story-kit.tsx'

// Doc 26 §12.1 `.badge`, `.kbd`, `.card`, `.bar`, `.spin`, `.hr`/`.vr`: always text with status
// colour on its own surface (§4.3), one amber mark per view at most (§4.5).
const BARS = Array.from({ length: 40 }, (_, index) => index + 1)

const meta = { title: 'Base/Display' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const BadgesDemo = () => (
  <div className="flex flex-wrap gap-1.5">
    <Badge variant="success">
      <CircleCheckIcon aria-hidden />
      Ready
    </Badge>
    <Badge variant="primary">
      <Spinner />
      Analysing 5/8
    </Badge>
    <Badge variant="unsure">6 unsure</Badge>
    <Badge variant="destructive">
      <CircleAlertIcon aria-hidden />
      Failed
    </Badge>
    <Badge>Queued</Badge>
    <Badge variant="warning">
      <TriangleAlertIcon aria-hidden />
      Rough tab
    </Badge>
    <Badge variant="info">
      <InfoIcon aria-hidden />
      Chords only
    </Badge>
    <Badge variant="outline">Lite</Badge>
  </div>
)

/** `.badge`: 22 px pills in 12/650 (the Foundations board's row). */
export const Badges: Story = {
  render: BadgesDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const ready = within(frame).getByText('Ready')
      const style = getComputedStyle(ready)
      await expect(ready.getBoundingClientRect().height).toBe(22)
      await expect([style.fontSize, style.fontWeight]).toEqual(['12px', '650'])
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
  </div>
)

/** `.kbd` in JetBrains Mono, which has ⌘ ⇧ ⌥ ↵. */
export const Keys: Story = {
  render: KbdDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const key = within(frame).getByText('⌘ K')
      const style = getComputedStyle(key)
      await expect(style.fontFamily).toMatch(/^"?JetBrains Mono/)
      await expect(key.getBoundingClientRect().height).toBe(22)
      await expect(style.borderBottomWidth).toBe('2px')
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

/** `.bar`: 6 px --accent track and --signal fill; the stage is named in aria-valuetext. */
export const Progresses: Story = {
  render: ProgressesDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const bar = within(frame).getAllByRole('progressbar')[0] as HTMLElement
      await expect(bar).toHaveAttribute('aria-valuetext', 'Separating stems, 62 %')
      const track = bar.querySelector('[data-slot="progress-track"]') as HTMLElement
      await expect(track.getBoundingClientRect().height).toBe(6)
    }
  },
}

export const ProgressInCard: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <Card className="max-w-sm px-4">
      <Progress value={40} getAriaValueText={() => 'Finding chords, 40 %'}>
        <ProgressLabel>Finding chords</ProgressLabel>
        <ProgressValue />
      </Progress>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const track = canvasElement.querySelector('[data-slot="progress-track"]') as HTMLElement
    await expect(track.getBoundingClientRect().height).toBe(4)
  },
}

export const Loading: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <div className="flex max-w-md flex-col gap-3" aria-busy="true">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading your song…
      </span>
    </div>
  ),
}

const CardsDemo = () => (
  <div className="flex flex-wrap items-start gap-4">
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Plus</CardTitle>
        <CardDescription>Full analyses with your part isolated, plus tab.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Press <Kbd>Space</Kbd> to play,{' '}
          <KbdGroup>
            <Kbd>⇧</Kbd>
            <Kbd>←</Kbd>
          </KbdGroup>{' '}
          to move the loop.
        </p>
      </CardContent>
      <CardFooter>Demo mode — no real charges.</CardFooter>
    </Card>
    <Card variant="emphasis" className="w-64">
      <CardHeader>
        <CardTitle>Pick up where you left off</CardTitle>
        <CardDescription>Bars 25–28 · best 80 %</CardDescription>
      </CardHeader>
    </Card>
  </div>
)

/** `.card`: --card, a 1 px --border edge, 16 px corners, no shadow; `emphasis` on --muted. */
export const Cards: Story = {
  render: CardsDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const card = frame.querySelector('[data-slot="card"]') as HTMLElement
      const style = getComputedStyle(card)
      await expect(style.borderTopLeftRadius).toBe('16px')
      await expect(style.borderTopWidth).toBe('1px')
      await expect(style.boxShadow).not.toMatch(/\d+px \d+px/)
    }
  },
}

export const Scrolling: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <div className="flex items-stretch gap-4">
      <ScrollArea
        className="h-48 w-72 rounded-lg border border-border"
        tabIndex={0}
        aria-label="Bars"
      >
        <ol className="p-4">
          {BARS.map((bar) => (
            <li key={bar} className="py-1 font-mono tabular-nums">
              Bar {bar}
            </li>
          ))}
        </ol>
      </ScrollArea>
      <Separator orientation="vertical" />
      <div className="flex w-40 flex-col gap-3 text-sm">
        Above
        <Separator />
        Below
      </div>
    </div>
  ),
}

const Gallery = () => (
  <StateGrid
    className="flex flex-col gap-6"
    states={[
      ['Badges', <BadgesDemo key="b" />],
      ['Keys', <KbdDemo key="k" />],
      ['Progress and meter', <ProgressesDemo key="p" />],
      ['Cards', <CardsDemo key="c" />],
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
