import { Link } from '@tanstack/react-router'
import { FileAudioIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
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

// The picked file (27 §3.6): name, size, duration and waveform from the local decode, pre-flight
// chips and the duplicate notice.
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
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <FileAudioIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-base font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
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
              <Badge variant="warning" className="h-auto min-h-6 py-0.5 whitespace-normal">
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
              <Button variant="outline" onClick={onImportAnyway}>
                {m['import.import_anyway']()}
              </Button>
            </>
          }
        />
      )}
    </section>
  )
}
