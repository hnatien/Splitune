import { Link } from '@tanstack/react-router'
import { MusicIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { formatBytes, formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Badge } from '@/ui/badge'
import { Button, buttonVariants } from '@/ui/button'
import { Spinner } from '@/ui/spinner'
import { InlineError } from '@/ui/status-message'
import { WaveformPreview } from '@/ui/waveform-preview'
import { isBlocking, type PreflightIssue } from './preflight'
import type { PickedFile } from './use-picked-file'

function issueText(issue: PreflightIssue): string {
  switch (issue.kind) {
    case 'too_long':
      return m['import.too_long']({ duration: formatDuration(issue.durationS) })
    case 'too_large':
      return m['import.too_large']()
    case 'quiet':
      return m['import.quiet']()
    case 'clipping':
      return m['import.clipping']()
    default:
      return m['import.mostly_silent']()
  }
}

// The picked file (27 §3.6, AddSong): a --muted card with the file tile, name, size and duration
// (mono), Remove, the 44 px waveform from the local decode, the warning badges that don't block,
// blocking errors inline and the duplicate notice (Open it / Add anyway).
export function FileRow({
  picked,
  onRemove,
  onImportAnyway,
}: {
  picked: PickedFile
  onRemove: () => void
  onImportAnyway: () => void
}) {
  const { file, audio } = picked
  const duration =
    audio?.kind === 'decoded'
      ? audio.stats.durationS
      : audio?.kind === 'needs_upload'
        ? audio.durationS
        : undefined
  const blocking = picked.issues.filter(isBlocking)
  const warnings = picked.issues.filter((issue) => !isBlocking(issue))
  return (
    <section
      aria-label={file.name}
      data-slot="file-card"
      className="flex flex-col gap-3 rounded-3xl border border-border bg-muted p-3.5"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-muted-foreground"
        >
          <MusicIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-base font-[650]" title={file.name}>
            {file.name}
          </p>
          <p className="font-mono text-sm text-faint-foreground tabular-nums">
            {[formatBytes(file.size), duration === undefined ? undefined : formatDuration(duration)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={m['import.remove_file']()}
          onClick={onRemove}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      {picked.status === 'reading' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden />
          {m['import.file_reading']()}
        </p>
      ) : audio?.kind === 'decoded' ? (
        <WaveformPreview
          className="h-11"
          peaks={audio.stats.peaks}
          label={m['import.waveform_label']({
            name: file.name,
            duration: formatDuration(audio.stats.durationS),
          })}
        />
      ) : audio?.kind === 'needs_upload' ? (
        <p className="text-sm text-muted-foreground">{m['import.preview_after_upload']()}</p>
      ) : null}

      {warnings.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={m['import.checks_label']()}>
          {warnings.map((issue) => (
            <li key={issue.kind}>
              <Badge className="h-auto min-h-5.5 py-0.5 whitespace-normal">
                <TriangleAlertIcon aria-hidden />
                {issueText(issue)}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {picked.unreadable && <InlineError title={m['import.unreadable']()} />}
      {blocking.map((issue) => (
        <InlineError key={issue.kind} title={issueText(issue)} />
      ))}
      {picked.duplicateOf && (
        <InlineError
          tone="info"
          title={m['import.duplicate']()}
          actions={
            <>
              <Link
                to="/songs/$songId/practice"
                params={{ songId: picked.duplicateOf }}
                className={buttonVariants({ variant: 'primary' })}
              >
                {m['import.open_it']()}
              </Link>
              <Button onClick={onImportAnyway}>{m['import.import_anyway']()}</Button>
            </>
          }
        />
      )}
    </section>
  )
}
