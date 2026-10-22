import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { PlayIcon } from 'lucide-react'
import { useEffect } from 'react'
import { client } from '@/lib/api'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { InlineError } from '@/ui/status-message'
import { PracticeLoading } from '../practice/practice-loading'
import { examplePractice, startingSpeed } from './defaults'
import { type ExampleSong, exampleFor, examplesQuery } from './examples'
import { StepFrame } from './onboarding-page'
import { type Answers, SongSummary, useStepViewed } from './song-parts'

// Step 4 of onboarding (27 §3.3): the example song chosen for the answers. A visitor goes on to
// its practice screen, where the guide (guide.tsx) shows the song card over it and "Play your
// part" starts the loop; a signed-in learner gets the example as a song in their library first.

export function FirstSong({
  instrument,
  level,
  signedIn,
  onBack,
}: Answers & { signedIn: boolean; onBack: () => void }) {
  const navigate = useNavigate()
  const examples = useQuery(examplesQuery)
  const example = exampleFor(examples.data?.items ?? [], instrument, level)
  // The starting speed becomes this device's default for new songs too (13 §1).
  useEffect(() => {
    if (example) usePracticeDefaults.getState().update({ speedPct: startingSpeed(example, level) })
  }, [example, level])
  useEffect(() => {
    if (signedIn || !example) return
    void navigate({
      to: '/songs/$songId/practice',
      params: { songId: example.song.id },
      search: { ...examplePractice(example, instrument, level), guide: true },
      replace: true,
    })
  }, [signedIn, example, instrument, level, navigate])

  if (examples.isPending || (example && !signedIn)) return <PracticeLoading />
  if (!example) {
    return (
      <StepFrame step={4} signedIn={signedIn} onBack={onBack}>
        <InlineError
          title={examples.isError ? m['start.examples_failed']() : m['start.coming']()}
          actions={
            examples.isError ? (
              <Button onClick={() => void examples.refetch()}>{m['common.retry']()}</Button>
            ) : undefined
          }
        />
      </StepFrame>
    )
  }
  return <SignedInSong example={example} instrument={instrument} level={level} onBack={onBack} />
}

function SignedInSong({
  example,
  onBack,
  ...answers
}: Answers & { example: ExampleSong; onBack: () => void }) {
  const navigate = useNavigate()
  useStepViewed('song', answers)
  const claim = useMutation({
    mutationFn: () =>
      client.examples.claim({
        id: example.id,
        ...(answers.instrument ? { instrument: answers.instrument } : {}),
        ...(answers.level ? { level: answers.level } : {}),
        loops: [],
        sessions: [],
        attempts: [],
        corrections: [],
      }),
    onSuccess: ({ song_id }) =>
      navigate({
        to: '/songs/$songId/practice',
        params: { songId: song_id },
        search: examplePractice(example, answers.instrument, answers.level),
      }),
  })
  return (
    <StepFrame step={4} signedIn onBack={onBack}>
      <h1 className="text-2xl">{m['start.song_title']()}</h1>
      <SongSummary example={example} />
      {claim.isError && <InlineError title={m['system.error']()} />}
      <Button
        variant="primary"
        size="practice"
        loading={claim.isPending}
        onClick={() => claim.mutate()}
      >
        <PlayIcon aria-hidden />
        {m['start.play_part']()}
      </Button>
    </StepFrame>
  )
}
