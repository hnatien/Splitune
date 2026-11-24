import { Link } from '@tanstack/react-router'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { Status } from '@/ui/status'
import { uploadPercent, useUploads } from './upload-store'

// "Uploading 42 %" (27 §3.6 primary action): uploads continue in the background while the learner
// practises; the shells show the newest unfinished one as a quiet link to its song, its state a
// glyph and words (a ring that fills, or a struck cloud while it waits for the connection).
export function UploadPill() {
  const item = useUploads((state) =>
    Object.values(state.items).find(
      (u) => u.phase === 'uploading' || u.phase === 'waiting_online' || u.phase === 'completing',
    ),
  )
  if (!item) return null
  const offline = item.phase === 'waiting_online'
  const pct = uploadPercent(item)
  return (
    <Link
      to="/songs/$songId/practice"
      params={{ songId: item.songId }}
      data-slot="upload-pill"
      className={buttonVariants({ variant: 'quiet', size: 'sm', className: 'min-w-0 px-2.5' })}
    >
      {offline ? (
        <Status kind="offline">{m['upload.waiting_online']()}</Status>
      ) : (
        <Status kind="working" progress={pct / 100}>
          {m['upload.uploading']({ pct: formatPercent(pct) })}
        </Status>
      )}
    </Link>
  )
}
