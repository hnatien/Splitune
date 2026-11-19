import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleCheckIcon, MicIcon, PlayIcon, UploadIcon } from 'lucide-react'
import { orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { Spinner } from '@/ui/spinner'
import { InlineError } from '@/ui/status-message'
import { FocusShell } from '../shell/focus-shell'
import { claimGuestProgress } from './claim'

// /start/saved (27 §3.3 → "Next: import your own song"): where "Save your progress?" lands once
// signed in. It claims what the visitor made on this device, says where it went, and
// offers the next step: a song of their own.
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
      <div className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
        {claim.isPending ? (
          <p role="status" className="flex items-center justify-center gap-3 text-base">
            <Spinner />
            {m['start.saving']()}
          </p>
        ) : claim.isError ? (
          <InlineError
            title={m['start.save_failed']()}
            actions={
              <Button onClick={() => void claim.refetch()}>{m['common.try_again']()}</Button>
            }
          />
        ) : (
          <section aria-labelledby="saved" className="flex flex-col items-center gap-3 text-center">
            <CircleCheckIcon aria-hidden strokeWidth={1.8} className="size-8 text-success" />
            <h1 id="saved" className="text-2xl text-balance">
              {songId ? m['start.saved_title']() : m['start.saved_nothing']()}
            </h1>
            {song.data && (
              <p className="text-base text-pretty text-muted-foreground">
                {m['start.saved_body']({ title: song.data.title })}
              </p>
            )}
          </section>
        )}
        <section
          aria-labelledby="next"
          className="flex flex-col items-center gap-3 border-t border-border pt-10 text-center"
        >
          <h2 id="next" className="text-xl text-balance">
            {m['start.next_title']()}
          </h2>
          <p className="text-base text-pretty text-muted-foreground">{m['start.next_body']()}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Link
              to="/library"
              search={{ add: 'file' }}
              className={buttonVariants({ variant: 'primary', size: 'practice-2' })}
            >
              <UploadIcon aria-hidden />
              {m['nav.add_song']()}
            </Link>
            <Link
              to="/library"
              search={{ add: 'record' }}
              className={buttonVariants({ variant: 'outline', size: 'practice-2' })}
            >
              <MicIcon aria-hidden />
              {m['start.record']()}
            </Link>
            {songId && (
              <Link
                to="/songs/$songId/practice"
                params={{ songId }}
                className={buttonVariants({ variant: 'ghost', size: 'practice-2' })}
              >
                <PlayIcon aria-hidden />
                {m['start.keep_practising']()}
              </Link>
            )}
          </div>
        </section>
      </div>
    </FocusShell>
  )
}
