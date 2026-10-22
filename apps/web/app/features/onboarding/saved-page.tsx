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

// /start/saved (27 §3.3 → "Next: import your own song"): where the magic link from "Save your
// progress?" lands. It claims what the visitor made on this device, says where it went, and
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
        {claim.isPending ? (
          <p role="status" className="flex items-center gap-3 text-base">
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
          <section aria-labelledby="saved" className="flex flex-col gap-2">
            <h1 id="saved" className="flex items-center gap-3 text-2xl">
              <CircleCheckIcon aria-hidden className="size-7 text-success" />
              {songId ? m['start.saved_title']() : m['start.saved_nothing']()}
            </h1>
            {song.data && (
              <p className="text-base text-muted-foreground">
                {m['start.saved_body']({ title: song.data.title })}
              </p>
            )}
          </section>
        )}
        <section
          aria-labelledby="next"
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <h2 id="next" className="text-xl">
            {m['start.next_title']()}
          </h2>
          <p className="text-base text-muted-foreground">{m['start.next_body']()}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/import"
              className={buttonVariants({ variant: 'primary', size: 'practice-2' })}
            >
              <UploadIcon aria-hidden />
              {m['library.import_song']()}
            </Link>
            <Link
              to="/import"
              search={{ tab: 'record' }}
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
