import { Link } from '@tanstack/react-router'
import { CloudOffIcon, UploadIcon } from 'lucide-react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Badge } from '@/ui/badge'
import { uploadPercent, useUploads } from './upload-store'

// "Uploading 42 %" (27 §3.6 primary action): uploads continue in the background while the learner
// practises; the pill shows the newest unfinished one and leads to its song.
export function UploadPill() {
  const item = useUploads((state) =>
    Object.values(state.items).find(
      (u) => u.phase === 'uploading' || u.phase === 'waiting_online' || u.phase === 'completing',
    ),
  )
  if (!item) return null
  const offline = item.phase === 'waiting_online'
  return (
    <Link to="/songs/$songId/practice" params={{ songId: item.songId }} className="rounded-full">
      <Badge variant="info" className="h-8 px-3 text-sm tabular-nums">
        {offline ? <CloudOffIcon aria-hidden /> : <UploadIcon aria-hidden />}
        {offline
          ? m['upload.waiting_online']()
          : m['upload.uploading']({ pct: formatPercent(uploadPercent(item)) })}
      </Badge>
    </Link>
  )
}
