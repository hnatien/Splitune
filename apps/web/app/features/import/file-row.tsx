import { Link } from '@tanstack/react-router'
import { FileAudioIcon, XIcon } from 'lucide-react'
import { formatBytes, formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
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

// The picked file (27 §3.6, AddSong), with no box around it: the file's name, size and duration,
// Remove, the 44 px waveform from the local decode, then each check that doesn't block as a glyph
// and words, blocking errors with the way out (choose another file), and the duplicate notice
// (Open it / Add anyway).
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
    <section aria-label={file.name} data-slot="file-card" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <FileAudioIcon
          aria-hidden
          strokeWidth={1.8}
          className="size-5 shrink-0 text-muted-foreground"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-label" title={file.name}>
            {file.name}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {[formatBytes(file.size), duration === undefined ? undefined : formatDuration(duration)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Button
          variant="quiet"
          size="icon"
          aria-label={m['import.remove_file']()}
          onClick={onRemove}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      {picked.status === 'reading' ? (
        <p role="status" className="flex items-center gap-2 text-body-sm text-muted-foreground">
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
        <p className="text-body-sm text-muted-foreground">{m['import.preview_after_upload']()}</p>
      ) : null}

      {warnings.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0" aria-label={m['import.checks_label']()}>
          {warnings.map((issue) => (
            <li key={issue.kind}>
              <InlineError tone="warning" title={issueText(issue)} />
            </li>
          ))}
        </ul>
      )}

      {(picked.unreadable || blocking.length > 0) && (
        <InlineError
          title={
            picked.unreadable ? m['import.unreadable']() : issueText(blocking[0] as PreflightIssue)
          }
          description={m['import.formats']()}
          actions={<Button onClick={onRemove}>{m['import.choose_another']()}</Button>}
        />
      )}
      {picked.duplicateOf && (
        <InlineError
          tone="info"
          title={m['import.duplicate']()}
          actions={
            <>
              <Link
                to="/songs/$songId/practice"
                params={{ songId: picked.duplicateOf }}
                className={buttonVariants({ variant: 'outline' })}
              >
                {m['import.open_it']()}
              </Link>
              <Button variant="quiet" onClick={onImportAnyway}>
                {m['import.import_anyway']()}
              </Button>
            </>
          }
        />
      )}
    </section>
  )
}
