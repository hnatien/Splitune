import type { Meta, StoryObj } from '@storybook/react-vite'
import { LibraryIcon, RepeatIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { AllowanceMeter } from './allowance-meter.tsx'
import { Button } from './button.tsx'
import { EmptyState } from './empty-state.tsx'
import { COPY } from './fixtures.ts'
import { PEDAL_HUD_MS, PedalHud } from './pedal-hud.tsx'
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
