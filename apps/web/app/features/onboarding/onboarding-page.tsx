import type { Instrument, Level } from '@splitune/contracts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  DrumIcon,
  GuitarIcon,
  LinkIcon,
  MicIcon,
  Music2Icon,
  PianoIcon,
  UploadIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useId, useState } from 'react'
import type { z } from 'zod'
import { client } from '@/lib/api'
import { usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { ChoiceRow, ChoiceRowGroup } from '@/ui/choice-row'
import { BassIcon } from '@/ui/icons/bass'
import { ListGroup, ListRow } from '@/ui/list-row'
import { Skeleton } from '@/ui/skeleton'
import { InlineError } from '@/ui/status-message'
import { FocusShell } from '../shell/focus-shell'
import { answersOf, examplePractice, startingSpeed } from './defaults'
import { type ExampleSong, exampleFor, examplesQuery } from './examples'
import { exampleMeta, partOf, useStepViewed } from './song-parts'

// Onboarding /start (27 §3.3, 13 §1, s47 direction): one page, then the song. What you play and
// how long you've played start at sensible defaults (defaults.ts) and pick the example and its
// starting speed as they change; the chosen song and what will happen sit in the bar at the
// bottom with the one primary action, so a visitor who keeps the defaults is one tap from the
// practice screen and one more (Play) from hearing their part. The reading distance is not asked:
// it starts from the device and is changed in practice's display options. A song of one's own
// (file, link or recording) goes through Add song, after creating an account when signed out.
// The answers and the song live in the URL (Back and reload keep them).

type InstrumentName = z.infer<typeof Instrument>
type LevelName = z.infer<typeof Level>

export interface StartSearch {
  instrument?: InstrumentName | undefined
  level?: LevelName | undefined
  /** The example chosen by hand; otherwise the one suggested for the answers. */
  song?: string | undefined
}

const INSTRUMENTS: {
  value: InstrumentName
  icon: React.ReactNode
  label: () => string
  unavailable?: boolean
}[] = [
  { value: 'guitar', icon: <GuitarIcon />, label: () => m['instrument.guitar']() },
  { value: 'bass', icon: <BassIcon />, label: () => m['instrument.bass']() },
  { value: 'piano', icon: <PianoIcon />, label: () => m['instrument.piano'](), unavailable: true },
  { value: 'drums', icon: <DrumIcon />, label: () => m['instrument.drums'](), unavailable: true },
  { value: 'other', icon: <Music2Icon />, label: () => m['instrument.other']() },
]

const LEVELS: { value: LevelName; label: () => string; hint: () => string }[] = [
  {
    value: 'just_started',
    label: () => m['settings.level_just_started'](),
    hint: () => m['start.level_just_started_hint'](),
  },
  {
    value: 'few_songs',
    label: () => m['settings.level_few_songs'](),
    hint: () => m['start.level_few_songs_hint'](),
  },
  {
    value: 'returning',
    label: () => m['settings.level_returning'](),
    hint: () => m['start.level_returning_hint'](),
  },
]

type Source = 'file' | 'link' | 'record'

const SOURCES: { value: Source; icon: React.ReactNode; title: () => string; hint: () => string }[] =
  [
    {
      value: 'file',
      icon: <UploadIcon aria-hidden />,
      title: () => m['start.own_file'](),
      hint: () => m['start.own_file_hint'](),
    },
    {
      value: 'link',
      icon: <LinkIcon aria-hidden />,
      title: () => m['start.own_link'](),
      hint: () => m['start.own_link_hint'](),
    },
    {
      value: 'record',
      icon: <MicIcon aria-hidden />,
      title: () => m['start.record'](),
      hint: () => m['start.own_record_hint'](),
    },
  ]

export function OnboardingPage({
  search,
  signedIn,
  go,
}: {
  search: StartSearch
  signedIn: boolean
  /** Replaces the answers in the URL. */
  go: (search: StartSearch) => void
}) {
  const answers = answersOf(search)
  // The funnel starts once, with the answers the visitor arrived with.
  const [arrived] = useState(() => ({
    instrument: search.instrument ?? null,
    level: search.level ?? null,
  }))
  useStepViewed('instrument', arrived)
  const examples = useQuery(examplesQuery)
  const items = examples.data?.items ?? []
  const suggested = exampleFor(items, answers.instrument, answers.level)
  const chosen = items.find((e) => e.id === search.song) ?? suggested
  const songs = suggested ? [suggested, ...items.filter((e) => e !== suggested)] : items
  const start = useStart({ signedIn, ...answers })
  const instrumentId = useId()
  const levelId = useId()
  const songsId = useId()

  return (
    <FocusShell exit={!signedIn}>
      <div className="mx-auto grid w-full max-w-library gap-x-16 gap-y-10 px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:grid-cols-2">
        <header className="flex flex-col gap-2 lg:col-span-2">
          <h1 className="text-display text-balance">{m['start.title']()}</h1>
          <p className="max-w-reading text-lead text-pretty text-muted-foreground">
            {m['start.hint']()}
          </p>
        </header>
        <div className="flex flex-col gap-10">
          <Question id={instrumentId} title={m['start.instrument_title']()}>
            <ChoiceRowGroup
              aria-labelledby={instrumentId}
              value={answers.instrument}
              onValueChange={(value) =>
                go({ ...search, instrument: value as InstrumentName, song: undefined })
              }
              className="sm:grid-cols-2"
            >
              {INSTRUMENTS.map((instrument) => (
                <ChoiceRow
                  key={instrument.value}
                  value={instrument.value}
                  icon={instrument.icon}
                  label={instrument.label()}
                  description={instrument.unavailable ? m['start.instrument_coming']() : undefined}
                  disabled={instrument.unavailable}
                />
              ))}
            </ChoiceRowGroup>
          </Question>
          <Question id={levelId} title={m['start.level_title']()}>
            <ChoiceRowGroup
              aria-labelledby={levelId}
              value={answers.level}
              onValueChange={(value) =>
                go({ ...search, level: value as LevelName, song: undefined })
              }
            >
              {LEVELS.map((level) => (
                <ChoiceRow
                  key={level.value}
                  value={level.value}
                  label={level.label()}
                  description={level.hint()}
                />
              ))}
            </ChoiceRowGroup>
          </Question>
        </div>
        <div className="flex flex-col gap-10">
          <Question id={songsId} title={m['start.song_title']()}>
            {examples.isPending ? (
              <div className="grid gap-2" aria-busy="true">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : examples.isError ? (
              <InlineError
                title={m['start.examples_failed']()}
                description={m['start.examples_failed_body']()}
                actions={
                  <Button onClick={() => void examples.refetch()}>{m['common.retry']()}</Button>
                }
              />
            ) : songs.length === 0 ? (
              <InlineError tone="info" title={m['start.coming']()} />
            ) : (
              <ChoiceRowGroup
                aria-labelledby={songsId}
                value={chosen?.id ?? null}
                onValueChange={(value) => go({ ...search, song: value as string })}
              >
                {songs.map((example) => (
                  <ChoiceRow
                    key={example.id}
                    value={example.id}
                    label={example.title}
                    description={
                      example === suggested
                        ? `${m['start.suggested']()} · ${exampleMeta(example)}`
                        : exampleMeta(example)
                    }
                  />
                ))}
              </ChoiceRowGroup>
            )}
            {start.failed && <InlineError title={m['system.error']()} />}
          </Question>
          <OwnSong signedIn={signedIn} />
        </div>
      </div>
      {chosen && (
        <StartBar
          example={chosen}
          level={answers.level}
          starting={start.pending}
          onStart={() => start.run(chosen)}
        />
      )}
    </FocusShell>
  )
}

function Question({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-title">
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * The one primary action, kept in reach at the bottom of the screen with what it will do: the
 * song, the part and the bars it loops at the starting speed.
 */
function StartBar({
  example,
  level,
  starting,
  onStart,
}: {
  example: ExampleSong
  level: LevelName
  starting: boolean
  onStart: () => void
}) {
  const bars = `${example.loop.start_bar + 1}–${example.loop.end_bar + 1}`
  return (
    <div
      data-slot="start-bar"
      className="sticky bottom-0 z-(--z-sticky) mt-auto border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-library items-center gap-4 px-4 py-3 sm:px-6">
        <p className="flex min-w-0 flex-1 flex-col text-body-sm text-muted-foreground">
          <span className="truncate text-label text-foreground">{example.title}</span>
          <span className="truncate">
            {m['start.plan']({
              part: partOf(example),
              bars,
              speed: formatPercent(startingSpeed(example, level)),
            })}
          </span>
        </p>
        <Button variant="primary" size="lg" loading={starting} onClick={onStart}>
          {m['start.start']()}
        </Button>
      </div>
    </div>
  )
}

/**
 * Opens the chosen example in practice. A visitor practises it on the device with the guide
 * (?guide); a signed-in learner gets it as a song in their library first. Either way the starting
 * speed becomes this device's default for new songs too (13 §1).
 */
function useStart({
  signedIn,
  instrument,
  level,
}: {
  signedIn: boolean
  instrument: InstrumentName
  level: LevelName
}) {
  const navigate = useNavigate()
  const claim = useMutation({
    mutationFn: (example: ExampleSong) =>
      client.examples.claim({
        id: example.id,
        instrument,
        level,
        loops: [],
        sessions: [],
        attempts: [],
        corrections: [],
      }),
    onSuccess: ({ song_id }, example) =>
      navigate({
        to: '/songs/$songId/practice',
        params: { songId: song_id },
        search: examplePractice(example, instrument, level),
      }),
  })
  return {
    pending: claim.isPending,
    failed: claim.isError,
    run: (example: ExampleSong) => {
      usePracticeDefaults.getState().update({ speedPct: startingSpeed(example, level) })
      if (signedIn) {
        claim.mutate(example)
        return
      }
      void navigate({
        to: '/songs/$songId/practice',
        params: { songId: example.song.id },
        search: { ...examplePractice(example, instrument, level), guide: true },
      })
    },
  }
}

/**
 * A song of one's own: Add song on its file, link or record tab, where the part picker follows.
 * Songs are analysed on Splitune's workers and kept in an account, so a visitor creates one first.
 */
function OwnSong({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <ListGroup title={m['start.own_title']()}>
        {SOURCES.map((source) => (
          <ListRow
            key={source.value}
            media={source.icon}
            title={source.title()}
            meta={source.hint()}
            render={
              signedIn ? (
                <Link to="/library" search={{ add: source.value }} />
              ) : (
                <Link to="/auth/sign-up" search={{ next: `/library?add=${source.value}` }} />
              )
            }
          />
        ))}
      </ListGroup>
      {!signedIn && (
        <p className="text-caption text-muted-foreground">{m['start.own_account']()}</p>
      )}
    </div>
  )
}
