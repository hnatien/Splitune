import type { Meta, StoryObj } from '@storybook/react-vite'
import { LibraryIcon, RepeatIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { EmptyState } from './empty-state.tsx'
import { COPY } from './fixtures.ts'
import { PEDAL_HUD_MS, PedalHud } from './pedal-hud.tsx'
import { Progress, ProgressLabel, ProgressValue } from './progress.tsx'
import { Skeleton } from './skeleton.tsx'
import { type Stage, StageList } from './stage-list.tsx'
import { Status, type StatusKind } from './status.tsx'
import { Banner, InlineError } from './status-message.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  isClear,
  shadowsOf,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'
import { WorkerStatus } from './worker-status.tsx'

// Doc 26 §12.2, §13, 27 §4–§5.4, s47 direction §4: feedback is a glyph and words. Stage lists,
// inline errors, banners, the worker's state and the empty state have no box and no tint; the
// glyph's shape says the state, hue joins in only for success and failure, and the one filled
// control in a view is its next step.
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

const STAGES: Stage[] = [
  {
    id: 'decode',
    label: 'Reading the audio',
    status: 'done',
    statusText: 'Done',
    detail: '3:12, stereo',
  },
  {
    id: 'beats',
    label: 'Finding the beat',
    status: 'done',
    statusText: 'Done',
    detail: '84 BPM in 4/4, starts on a pickup bar',
  },
  {
    id: 'separate',
    label: 'Isolating your part',
    status: 'running',
    statusText: '~2 min',
    detail: 'Separating guitar from the band',
  },
  {
    id: 'chords',
    label: 'Working out the chords',
    status: 'queued',
    statusText: 'Waiting',
    detail: 'Also finds the key',
  },
  {
    id: 'notes',
    label: 'Building the tab',
    status: 'queued',
    statusText: 'Waiting',
    detail: 'Fingerings you can actually play',
  },
]

const StagesDemo = () => (
  <StageList
    stages={STAGES}
    progress={46}
    progressLabel="Analysing your song"
    className="max-w-lg"
  />
)

/**
 * One overall bar (27 §3.7.3), then each stage as a glyph and words: a circled check when done, the
 * filling ring while running, a dashed circle while waiting. No filled dots.
 */
export const Stages: Story = {
  render: StagesDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      await expect(within(frame).getAllByRole('progressbar')).toHaveLength(1)
      const glyphs = [...frame.querySelectorAll<HTMLElement>('[data-slot=stage-glyph]')]
      await expect(glyphs).toHaveLength(STAGES.length)
      for (const glyph of glyphs) {
        await expect(glyph.querySelector('svg')).not.toBeNull()
        await expect(isClear(getComputedStyle(glyph).backgroundColor)).toBe(true)
      }
      const shape = (status: string) =>
        frame.querySelector(`[data-status=${status}] [data-slot=stage-glyph]`)?.innerHTML
      await expect(new Set([shape('done'), shape('running'), shape('queued')]).size).toBe(3)
      // A waiting stage's name is faint but still text (≥ 4.5:1); its state is also in words.
      const waiting = within(frame).getByText('Working out the chords')
      await expect(
        contrast(getComputedStyle(waiting).color, surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(4.5)
      await expect(within(frame).getAllByText('Waiting')).toHaveLength(2)
      await expect(within(frame).getByText('Separating guitar from the band')).toBeVisible()
    }
  },
}
export const StagesStage: Story = { render: StagesDemo, globals: { appearance: 'stage' } }

function HandoffDemo() {
  const [step, setStep] = useState(0)
  const stages = STAGES.map((stage, index): Stage => {
    const at = index - 2 - step
    return at < 0
      ? { ...stage, status: 'done', statusText: 'Done' }
      : at === 0
        ? { ...stage, status: 'running', statusText: '~1 min' }
        : { ...stage, status: 'queued', statusText: 'Waiting' }
  })
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Button variant="outline" className="self-start" onClick={() => setStep((n) => n + 1)}>
        Next stage
      </Button>
      <StageList stages={stages} progress={46 + step * 18} progressLabel="Analysing your song" />
    </div>
  )
}

/**
 * The handoff: only the running stage opens its detail; when it finishes its tick draws itself, its
 * detail folds and rises beside its name, and the next stage brightens, opens its detail and starts
 * its turning ring. Stages already done when the list first rendered keep their plain tick.
 */
export const StagesHandoff: Story = {
  render: HandoffDemo,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const row = (label: string) => within(frame).getByText(label).closest('li') as HTMLElement
      const detail = (label: string) => row(label).querySelector('[data-slot=stage-detail]')
      const result = (label: string) => row(label).querySelector('[data-slot=stage-result]')
      await expect(detail('Working out the chords')).toHaveAttribute('data-folded')
      await expect(detail('Isolating your part')).not.toHaveAttribute('data-folded')
      await expect(result('Reading the audio')).toHaveTextContent('3:12, stereo')
      await expect(detail('Reading the audio')).toHaveAttribute('aria-hidden', 'true')
      await expect(row('Reading the audio').querySelector('.lucide-circle-check-draw')).toBeNull()
      await userEvent.click(within(frame).getByRole('button', { name: 'Next stage' }))
      await expect(row('Isolating your part')).toHaveAttribute('data-status', 'done')
      await expect(detail('Isolating your part')).toHaveAttribute('data-folded')
      await expect(result('Isolating your part')).toHaveTextContent('Separating guitar')
      await expect(
        row('Isolating your part').querySelector('.lucide-circle-check-draw'),
      ).not.toBeNull()
      await expect(row('Working out the chords')).toHaveAttribute('data-status', 'running')
      await expect(detail('Working out the chords')).not.toHaveAttribute('data-folded')
      await expect(row('Reading the audio').querySelector('.lucide-circle-check-draw')).toBeNull()
    }
  },
}

/** A fallback is a triangle in grey and a failure a crossed circle in red, each with its words. */
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
          statusText: 'Not available, showing chords',
        },
      ]}
    />
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const failed = frame.querySelector('[data-status=failed] [data-slot=stage-glyph] svg')
      const fallback = frame.querySelector('[data-status=fallback] [data-slot=stage-glyph] svg')
      await expect(failed?.innerHTML).not.toBe(fallback?.innerHTML)
      await expect(
        contrast(getComputedStyle(failed as Element).color, surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
      await expect(within(frame).getByText('Not available, showing chords')).toBeVisible()
    }
  },
}

/** The worker being offline is a calm line in the ink with a clock: not a box and not an error. */
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
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const status = within(frame).getByRole('status')
      const style = getComputedStyle(status)
      await expect(isClear(style.backgroundColor)).toBe(true)
      await expect(style.borderTopWidth).toBe('0px')
      await expect(status.querySelector('svg')).not.toBeNull()
      await expect(status).toHaveTextContent(COPY.queuedOffline)
      await expect(contrast(style.color, surfaceOf(frame))).toBeGreaterThanOrEqual(7)
    }
  },
}
export const WorkerOnline: Story = {
  render: () => <WorkerStatus online text={COPY.workerOnline} />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const status = within(frame).getByRole('status')
      await expect(isClear(getComputedStyle(status).backgroundColor)).toBe(true)
      await expect(status).toHaveAttribute('data-online', 'true')
    }
  },
}

const EmptyDemo = ({ title }: { title?: string }) => (
  <EmptyState
    icon={<LibraryIcon aria-hidden />}
    title={title}
    description={COPY.libraryEmpty}
    action={<Button variant="primary">{COPY.importSong}</Button>}
    secondaryAction={<Button variant="outline">{COPY.tryExample}</Button>}
  />
)

/** No box, no fill behind the icon; a heading, one sentence and one filled action. */
export const Empty: Story = {
  render: () => <EmptyDemo title="No songs yet" />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const empty = frame.querySelector('[data-slot=empty-state]') as HTMLElement
      await expect(isClear(getComputedStyle(empty).backgroundColor)).toBe(true)
      await expect(getComputedStyle(empty).borderTopWidth).toBe('0px')
      const icon = frame.querySelector('[data-slot=empty-state-icon]') as HTMLElement
      await expect(isClear(getComputedStyle(icon).backgroundColor)).toBe(true)
      await expect(within(frame).getByRole('heading', { level: 2 })).toHaveTextContent(
        'No songs yet',
      )
      const filled = frame.querySelectorAll('button[data-variant=primary]')
      await expect(filled).toHaveLength(1)
    }
  },
}
export const EmptyWithoutTitle: Story = { render: () => <EmptyDemo />, globals: BOTH_THEMES }

export const Errors: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <InlineError
        title={COPY.libraryFailed}
        actions={<Button variant="outline">{COPY.retry}</Button>}
      />
      <InlineError
        title={COPY.unreadable}
        description="It may be damaged, or in a format this browser can't open."
        actions={
          <>
            <Button variant="primary">{COPY.tryAnotherFile}</Button>
            <Button variant="outline">{COPY.recordYourself}</Button>
          </>
        }
      />
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const alerts = within(frame).getAllByRole('alert')
      await expect(alerts).toHaveLength(2)
      for (const alert of alerts) {
        await expect(isClear(getComputedStyle(alert).backgroundColor)).toBe(true)
        const glyph = alert.querySelector('svg') as SVGElement
        await expect(
          contrast(getComputedStyle(glyph).color, surfaceOf(frame)),
        ).toBeGreaterThanOrEqual(3)
      }
    }
  },
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
      <Banner tone="success" title="You're on Plus" description="Full analyses are on." />
    </div>
  )
}

export const BannerStates: Story = {
  render: Banners,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dismiss = canvas.getByRole('button', { name: COPY.dismiss })
    await expect(dismiss.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    await userEvent.click(dismiss)
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

/**
 * Inline messages and banners in every tone: no surface and no box, a glyph whose shape differs by
 * tone (≥ 3:1 on the page), the title in the ink. Banners keep one hairline below.
 */
export const StatusTonesLight: Story = {
  render: StatusTones,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const boxes = [
      ...canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot=inline-error], [data-slot=banner]',
      ),
    ]
    await expect(boxes).toHaveLength(8)
    for (const box of boxes) {
      const style = getComputedStyle(box)
      await expect(isClear(style.backgroundColor)).toBe(true)
      await expect(style.borderTopWidth).toBe('0px')
      await expect(shadowsOf(box)).toEqual([])
      const glyph = box.querySelector('svg') as SVGElement
      await expect(contrast(getComputedStyle(glyph).color, surfaceOf(box))).toBeGreaterThanOrEqual(
        3,
      )
      if (box.getAttribute('data-slot') === 'banner')
        await expect(style.borderBottomWidth).toBe('1px')
    }
    // Four tones, four glyph shapes.
    const inline = boxes.filter((box) => box.getAttribute('data-slot') === 'inline-error')
    await expect(new Set(inline.map((box) => box.querySelector('svg')?.innerHTML)).size).toBe(4)
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
    // The banner's rule moves one step up the ramp; the words and glyphs keep their contrast.
    for (const banner of canvasElement.querySelectorAll<HTMLElement>('[data-slot=banner]')) {
      await expect(getComputedStyle(banner).borderBottomWidth).toBe('1px')
    }
    for (const description of canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot=inline-error] p + p',
    )) {
      await expect(
        contrast(getComputedStyle(description).color, surfaceOf(description)),
      ).toBeGreaterThanOrEqual(7)
    }
  },
}

const STATUS_LINES: [StatusKind, string][] = [
  ['ready', 'Ready'],
  ['attention', 'Rough tab'],
  ['working', 'Analysing'],
  ['failed', 'Failed'],
  ['offline', 'Processing machine offline'],
]

const StatusLines = () => (
  <div className="flex flex-wrap gap-x-6 gap-y-3">
    {STATUS_LINES.map(([kind, words]) => (
      <Status key={kind} kind={kind}>
        {words}
      </Status>
    ))}
  </div>
)

/** What replaced the status badge: a glyph and words, with no surface behind either. */
export const StatusLineStates: Story = {
  render: StatusLines,
  globals: BOTH_THEMES_MORE_CONTRAST,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      for (const [, words] of STATUS_LINES) {
        const status = within(frame).getByText(words).closest('[data-slot=status]') as HTMLElement
        await expect(isClear(getComputedStyle(status).backgroundColor)).toBe(true)
        await expect(getComputedStyle(status).borderTopWidth).toBe('0px')
        await expect(status.querySelector('svg')).not.toBeNull()
      }
    }
  },
}
export const StatusLinesStage: Story = { render: StatusLines, globals: { appearance: 'stage' } }

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
  play: async ({ canvasElement }) => {
    // Waiting with no estimate still says so in words beside the bar.
    await expect(within(canvasElement).getByText('No estimate yet')).toBeVisible()
  },
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
    <InlineError
      title={COPY.libraryFailed}
      actions={<Button variant="outline">{COPY.retry}</Button>}
    />
    <Banners />
  </div>
)
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const StageAppearance: Story = { render: Gallery, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = { render: Gallery, globals: BOTH_THEMES_MORE_CONTRAST }
