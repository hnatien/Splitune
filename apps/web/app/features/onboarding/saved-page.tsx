import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleCheckIcon, MicIcon, PlayIcon, UploadIcon } from 'lucide-react'
import { orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { ListGroup, ListRow } from '@/ui/list-row'
import { MusicStrip } from '@/ui/music-strip'
import { Spinner } from '@/ui/spinner'
import { InlineError } from '@/ui/status-message'
import { FocusShell } from '../shell/focus-shell'
import { claimGuestProgress } from './claim'

// /start/saved (27 §3.3 → "Next: import your own song"): where "Save your progress?" lands once
// signed in. It claims what the visitor made on this device, says where it went (the song as a
// row, with the way back to it), and offers the next step: a song of their own. One filled action:
// Add song, or "Try again" while the claim has failed.
export function SavedPage() {
  const queryClient = useQueryClient()
  const claim = useQuery({
    queryKey: ['guest-claim'],
    queryFn: () => claimGuestProgress(queryClient),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  const songId = claim.data?.[0]
  const song = useQuery({
    ...orpc.songs.get.queryOptions({ input: { id: songId ?? '' } }),
    enabled: songId !== undefined,
  })

  return (
    <FocusShell>
      <div className="mx-auto flex w-full max-w-bare flex-col gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        {claim.isPending ? (
          <p role="status" className="flex items-center gap-3 text-body">
            <Spinner />
            {m['start.saving']()}
          </p>
        ) : claim.isError ? (
          <InlineError
            title={m['start.save_failed']()}
            description={m['start.save_failed_body']()}
            actions={
              <Button variant="primary" onClick={() => void claim.refetch()}>
                {m['common.try_again']()}
              </Button>
            }
          />
        ) : (
          <section aria-labelledby="saved" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <CircleCheckIcon aria-hidden strokeWidth={1.8} className="size-8 text-success" />
              <h1 id="saved" className="text-display text-balance">
                {songId ? m['start.saved_title']() : m['start.saved_nothing']()}
              </h1>
              {(!songId || song.data) && (
                <p className="text-body text-pretty text-muted-foreground">
                  {song.data
                    ? m['start.saved_body']({ title: song.data.title })
                    : m['start.saved_nothing_body']()}
                </p>
              )}
            </div>
            {songId && song.data && (
              <ListGroup>
                <ListRow
                  media={<MusicStrip className="w-16 sm:w-24" />}
                  title={song.data.title}
                  meta={song.data.artist ?? undefined}
                  aside={
                    <Link
                      to="/songs/$songId/practice"
                      params={{ songId }}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <PlayIcon aria-hidden />
                      {m['start.keep_practising']()}
                    </Link>
                  }
                />
              </ListGroup>
            )}
          </section>
        )}
        <section aria-labelledby="next" className="flex flex-col gap-3">
          <h2 id="next" className="text-heading text-balance">
            {m['start.next_title']()}
          </h2>
          <p className="text-body text-pretty text-muted-foreground">{m['start.next_body']()}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              to="/library"
              search={{ add: 'file' }}
              className={buttonVariants({
                variant: claim.isError ? 'outline' : 'primary',
                size: 'practice',
              })}
            >
              <UploadIcon aria-hidden />
              {m['nav.add_song']()}
            </Link>
            <Link
              to="/library"
              search={{ add: 'record' }}
              className={buttonVariants({ variant: 'outline', size: 'practice' })}
            >
              <MicIcon aria-hidden />
              {m['start.record']()}
            </Link>
          </div>
        </section>
      </div>
    </FocusShell>
  )
}
