import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CircleCheckIcon,
  InfoIcon,
  LibraryIcon,
  OctagonXIcon,
  RepeatIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useState } from 'react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { AllowanceMeter } from './allowance-meter.tsx'
import { Badge } from './badge.tsx'
import { Button } from './button.tsx'
import { EmptyState } from './empty-state.tsx'
import { COPY } from './fixtures.ts'
import { PEDAL_HUD_MS, PedalHud } from './pedal-hud.tsx'
import { Progress, ProgressLabel, ProgressValue } from './progress.tsx'
import { Skeleton } from './skeleton.tsx'
import { type Stage, StageList } from './stage-list.tsx'
import { Banner, InlineError } from './status-message.tsx'
import { WorkerStatus } from './worker-status.tsx'

const meta = { title: 'Kit/Feedback' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function HudDemo() {
  const [event, setEvent] = useState<{ message: string | null; sequence: number }>({
    message: null,
    sequence: 0,
  })
  const fire = (message: string) =>
    setEvent((current) => ({ message, sequence: current.sequence + 1 }))
  return (
    <div className="flex gap-3">
      <Button onClick={() => fire('Loop on')}>Press L</Button>
      <Button onClick={() => fire('Speed 75 %')}>Press +</Button>
      <PedalHud
        message={event.message}
        sequence={event.sequence}
        icon={<RepeatIcon aria-hidden />}
      />
    </div>
  )
}

export const Hud: Story = {
  render: HudDemo,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Press L' }))
    await expect(screen.getByRole('status')).toHaveTextContent('Loop on')
    const hud = document.querySelector<HTMLElement>('[data-slot=pedal-hud]')
    await expect(hud).toHaveAttribute('data-visible')
    await waitFor(() => expect(hud).not.toHaveAttribute('data-visible'), {
      timeout: PEDAL_HUD_MS + 500,
    })
  },
}
export const HudVisibleStage: Story = {
  render: HudDemo,
  globals: { appearance: 'stage', distance: 'stand' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Press +' }))
  },
}

// What the browser reports for `transparent`, read from a probe element.
const transparent = () => {
  const probe = document.createElement('div')
  probe.className = 'bg-transparent'
  document.body.append(probe)
  const { backgroundColor } = getComputedStyle(probe)
  probe.remove()
  return backgroundColor
}

const STAGES: Stage[] = [
  { id: 'decode', label: 'Reading the file', status: 'done', statusText: 'Done' },
  { id: 'beats', label: 'Finding the beat', status: 'done', statusText: 'Done' },
  {
    id: 'separate',
    label: 'Separating your part',
    status: 'running',
    statusText: 'About 2 min left',
  },
  { id: 'chords', label: 'Working out the chords', status: 'queued', statusText: 'Queued' },
  { id: 'notes', label: 'Writing the tab', status: 'queued', statusText: 'Queued' },
]

export const Stages: Story = {
  render: () => (
    <StageList
      stages={STAGES}
      progress={46}
      progressLabel="Analysing your song"
      className="max-w-lg"
    />
  ),
  play: async ({ canvasElement }) => {
    // The overall bar is the one progressbar; the running stage's own bar is decorative.
    await expect(within(canvasElement).getAllByRole('progressbar')).toHaveLength(1)
    const running = canvasElement.querySelector<HTMLElement>('[data-status=running]')
    const indicator = running?.querySelector<HTMLElement>('[data-slot=progress-indicator]')
    await expect(indicator).toHaveAttribute('data-indeterminate')
    await expect(getComputedStyle(indicator as Element).animationName).toBe(
      'progress-indeterminate',
    )
    const done = canvasElement.querySelectorAll<SVGPathElement>('[data-status=done] svg path')
    await expect(done).toHaveLength(2)
    for (const tick of done) {
      await expect(tick).toHaveAttribute('pathLength', '1')
      await expect(getComputedStyle(tick).animationName).toBe('check-draw')
    }
    await expect(
      canvasElement.querySelector('[data-status=queued] [data-slot=progress]'),
    ).toBeNull()
  },
}
export const StagesDark: Story = {
  render: () => (
    <StageList
      stages={STAGES}
      progress={46}
      progressLabel="Analysing your song"
      className="max-w-lg"
    />
  ),
  globals: { appearance: 'dark' },
}
export const StagesWithFallback: Story = {
  render: () => (
    <StageList
      className="max-w-lg"
      progress={100}
      progressLabel="Analysing your song"
      stages={[
        ...STAGES.slice(0, 2),
        {
          id: 'separate',
          label: 'Separating your part',
          status: 'fallback',
          statusText: 'Used a backup model',
        },
        { id: 'chords', label: 'Working out the chords', status: 'done', statusText: 'Done' },
        {
          id: 'notes',
          label: 'Writing the tab',
          status: 'failed',
          statusText: 'Not available — showing chords',
        },
      ]}
    />
  ),
}
export const WorkerOffline: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-4">
      <WorkerStatus online={false} text={COPY.queuedOffline} />
      <StageList
        progress={0}
        progressLabel="Analysing your song"
        stages={STAGES.map((stage) => ({ ...stage, status: 'queued', statusText: 'Queued' }))}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status')
    // A warning surface, not a muted well with a coloured border.
    await expect(getComputedStyle(status).backgroundColor).not.toBe(transparent())
    await expect(getComputedStyle(status).borderTopColor).toBe(transparent())
  },
}
export const WorkerOnline: Story = {
  render: () => <WorkerStatus online text={COPY.workerOnline} />,
}

export const Allowance: Story = {
  render: () => <AllowanceMeter left={4} limit={5} text={COPY.allowance} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('meter')).toHaveAttribute(
      'aria-valuetext',
      COPY.allowance,
    )
    const track = canvasElement.querySelector<HTMLElement>('[data-slot=meter-track]') as HTMLElement
    const sunken = document.createElement('div')
    sunken.className = 'bg-surface-sunken'
    document.body.append(sunken)
    await expect(getComputedStyle(track).backgroundColor).toBe(
      getComputedStyle(sunken).backgroundColor,
    )
    sunken.remove()
  },
}

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<LibraryIcon aria-hidden />}
      description={COPY.libraryEmpty}
      action={<Button variant="primary">{COPY.importSong}</Button>}
      secondaryAction={<Button variant="outline">{COPY.tryExample}</Button>}
    />
  ),
}

export const Errors: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <InlineError
        title={COPY.libraryFailed}
        actions={<Button variant="outline">{COPY.retry}</Button>}
      />
      <InlineError
        title={COPY.unreadable}
        actions={
          <>
            <Button variant="primary">{COPY.tryAnotherFile}</Button>
            <Button variant="outline">{COPY.recordYourself}</Button>
          </>
        }
      />
    </div>
  ),
}

function Banners() {
  const [offline, setOffline] = useState(true)
  return (
    <div className="flex flex-col gap-3">
      {offline && (
        <Banner
          tone="info"
          title={COPY.offline}
          dismiss={{ label: COPY.dismiss, onDismiss: () => setOffline(false) }}
        />
      )}
      <Banner tone="warning" title={COPY.demo} />
      <Banner
        tone="error"
        title={COPY.unsupported}
        actions={
          <Button variant="outline" size="sm">
            {COPY.supportedBrowsers}
          </Button>
        }
      />
      <Banner tone="success" title="You're on Plus!" />
    </div>
  )
}

export const BannerStates: Story = {
  render: Banners,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: COPY.dismiss }))
    await expect(canvas.queryByText(COPY.offline)).not.toBeInTheDocument()
  },
}

const TONE_COPY = {
  error: 'Something went wrong',
  warning: 'Check this first',
  info: 'For your information',
  success: 'All done',
} as const

const StatusTones = () => (
  <div className="flex max-w-xl flex-col gap-3">
    {(['error', 'warning', 'info', 'success'] as const).map((tone) => (
      <InlineError
        key={tone}
        tone={tone}
        title={TONE_COPY[tone]}
        description="What it means for you."
        actions={<Button variant="outline">{COPY.retry}</Button>}
      />
    ))}
    {(['error', 'warning', 'info', 'success'] as const).map((tone) => (
      <Banner key={tone} tone={tone} title={`${TONE_COPY[tone]} (banner)`} />
    ))}
  </div>
)

export const StatusTonesLight: Story = {
  render: StatusTones,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = getComputedStyle(document.body).backgroundColor
    const boxes = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot=inline-error], [data-slot=banner]',
    )
    await expect(boxes).toHaveLength(8)
    for (const box of boxes) {
      const style = getComputedStyle(box)
      // A tinted surface and an icon carry the tone; the hairline border waits for increased contrast.
      await expect(style.backgroundColor).not.toBe(page)
      await expect(style.backgroundColor).not.toBe(transparent())
      await expect(style.borderTopColor).toBe(transparent())
      await expect(box.querySelector('svg')).not.toBeNull()
    }
    await expect(
      canvas.getByText(TONE_COPY.error, { selector: 'p' }).closest('[role=alert]'),
    ).not.toBeNull()
    await expect(canvas.getAllByRole('status').length).toBeGreaterThanOrEqual(6)
    const banner = canvasElement.querySelector<HTMLElement>('[data-slot=banner]') as HTMLElement
    await expect(getComputedStyle(banner).animationName).toBe('rise-in')
  },
}
export const StatusTonesDark: Story = { render: StatusTones, globals: { appearance: 'dark' } }
export const StatusTonesStage: Story = { render: StatusTones, globals: { appearance: 'stage' } }
export const StatusTonesIncreasedContrast: Story = {
  render: StatusTones,
  globals: { contrast: 'more' },
  play: async ({ canvasElement }) => {
    const boxes = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot=inline-error], [data-slot=banner]',
    )
    for (const box of boxes) {
      await expect(getComputedStyle(box).borderTopColor).not.toBe(transparent())
      await expect(getComputedStyle(box).borderTopWidth).toBe('1px')
    }
  },
}

const StatusBadges = () => (
  <div className="flex flex-wrap gap-2">
    <Badge variant="success">
      <CircleCheckIcon aria-hidden />
      Ready
    </Badge>
    <Badge variant="warning">
      <TriangleAlertIcon aria-hidden />
      Rough tab
    </Badge>
    <Badge variant="info">
      <InfoIcon aria-hidden />
      Analysing
    </Badge>
    <Badge variant="destructive">
      <OctagonXIcon aria-hidden />
      Failed
    </Badge>
  </div>
)

export const StatusBadgeStates: Story = {
  render: StatusBadges,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Ready', 'Rough tab', 'Analysing', 'Failed']) {
      const badge = canvas.getByText(name)
      await expect(getComputedStyle(badge).backgroundColor).not.toBe(
        getComputedStyle(document.body).backgroundColor,
      )
      await expect(getComputedStyle(badge).borderTopWidth).toBe('1px')
    }
  },
}
export const StatusBadgesDark: Story = { render: StatusBadges, globals: { appearance: 'dark' } }
export const StatusBadgesStage: Story = { render: StatusBadges, globals: { appearance: 'stage' } }

const IndeterminateProgress = () => (
  <Progress value={null} className="max-w-md">
    <ProgressLabel>Waiting for your Mac</ProgressLabel>
    <ProgressValue>{() => 'No estimate yet'}</ProgressValue>
  </Progress>
)

export const ProgressIndeterminate: Story = {
  render: IndeterminateProgress,
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole('progressbar')
    await expect(bar).toHaveAttribute('data-indeterminate')
    const indicator = canvasElement.querySelector<HTMLElement>('[data-slot=progress-indicator]')
    const track = canvasElement.querySelector<HTMLElement>('[data-slot=progress-track]')
    await expect(indicator).toHaveAttribute('data-indeterminate')
    await expect(getComputedStyle(indicator as Element).animationName).toBe(
      'progress-indeterminate',
    )
    const ratio = (indicator as HTMLElement).offsetWidth / (track as HTMLElement).clientWidth
    await expect(ratio).toBeGreaterThan(0.39)
    await expect(ratio).toBeLessThan(0.41)
  },
}
export const ProgressIndeterminateReducedMotion: Story = {
  render: IndeterminateProgress,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const indicator = canvasElement.querySelector<HTMLElement>('[data-slot=progress-indicator]')
    await expect(getComputedStyle(indicator as Element).animationDuration).toBe('0s')
  },
}
export const ProgressIndeterminateStage: Story = {
  render: IndeterminateProgress,
  globals: { appearance: 'stage' },
}

export const SkeletonShimmer: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3" aria-busy="true">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector('[data-slot=skeleton]') as Element
    await expect(getComputedStyle(skeleton).animationName).not.toBe('none')
    await expect(getComputedStyle(skeleton).backgroundImage).toContain('linear-gradient')
  },
}

const Gallery = () => (
  <div className="flex flex-col gap-8">
    <StageList
      stages={STAGES}
      progress={46}
      progressLabel="Analysing your song"
      className="max-w-lg"
    />
    <WorkerStatus online={false} text={COPY.queuedOffline} />
    <AllowanceMeter left={4} limit={5} text={COPY.allowance} />
    <InlineError
      title={COPY.libraryFailed}
      actions={<Button variant="outline">{COPY.retry}</Button>}
    />
    <Banners />
  </div>
)
export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const StageAppearance: Story = { render: Gallery, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }
