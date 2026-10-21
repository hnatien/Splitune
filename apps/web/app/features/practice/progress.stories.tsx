import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { expect, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { AppStory } from '../../../.storybook/app.tsx'
import { useUploads } from '../import/upload-store'
import { statsQuery, workerStatusQuery } from '../library/queries'
import { analysis, detail, STATS, WORKER_OFFLINE, WORKER_ONLINE } from '../story-fixtures'
import { ProgressPage } from './progress-page'

// The provisional practice page (step 10) while a song is analysed (27 §3.7.3): uploading,
// analysing with an ETA, waiting for the Mac, failed, and finished.
const meta = {
  title: 'Screens/Practice progress',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const SONG = 2
type Run = ReturnType<typeof analysis> | null

function seed(run: Run, worker = WORKER_ONLINE) {
  return (client: QueryClient) => {
    const song = detail(SONG, run)
    client.setQueryData(orpc.songs.get.queryKey({ input: { id: song.id } }), song)
    if (run) client.setQueryData(orpc.analyses.get.queryKey({ input: { id: run.id } }), run)
    client.setQueryData(statsQuery.queryKey, STATS)
    client.setQueryData(workerStatusQuery.queryKey, worker)
  }
}

function Uploading({ phase }: { phase: 'uploading' | 'needs_file' }) {
  const songId = detail(SONG, null).id
  useEffect(() => {
    useUploads
      .getState()
      .upsert(songId, { title: 'Walking bass in F', phase, bytesUploaded: 42, bytesTotal: 100 })
    return () => useUploads.getState().remove(songId)
  }, [songId, phase])
  return <ProgressPage songId={songId} />
}

const screen =
  (run: Run, worker = WORKER_ONLINE) =>
  () => (
    <AppStory path="/songs/x/practice" seed={seed(run, worker)}>
      <ProgressPage songId={detail(SONG, null).id} />
    </AppStory>
  )

export const Analysing: Story = {
  render: screen(analysis(SONG, 'running')),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Analysing your song · About \d+ min left/)).toBeVisible()
    await expect(canvas.getByText('Isolating your part').closest('li')).toHaveAttribute(
      'data-status',
      'running',
    )
  },
}
export const AnalysingDark: Story = {
  render: screen(analysis(SONG, 'running')),
  globals: { appearance: 'dark' },
}
export const AnalysingStage: Story = {
  render: screen(analysis(SONG, 'running')),
  globals: { appearance: 'stage' },
}

export const WaitingForMac: Story = {
  render: screen(analysis(SONG, 'queued'), WORKER_OFFLINE),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/Processing machine offline/)).toBeVisible()
  },
}

export const Failed: Story = {
  render: screen(analysis(SONG, 'failed')),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/We couldn't analyse this song/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

export const Finished: Story = {
  render: screen(analysis(SONG, 'done')),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Analysis finished', {
        selector: '[data-slot=progress-label]',
      }),
    ).toBeVisible()
  },
}

export const UploadInProgress: Story = {
  render: () => (
    <AppStory path="/songs/x/practice" seed={seed(null)}>
      <Uploading phase="uploading" />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/^Uploading 42/)).toBeVisible()
  },
}

export const UploadNeedsFile: Story = {
  render: () => (
    <AppStory path="/songs/x/practice" seed={seed(null)}>
      <Uploading phase="needs_file" />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('button', { name: 'Choose the file' }),
    ).toBeVisible()
  },
}
