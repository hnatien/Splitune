import type { SourceKind } from '@splitune/contracts'
import type { z } from 'zod'

// Which audio the practice screen loads (12 §4): the stems once they are listed, else this page's
// own file, else the song's audio once it exists; nothing while piano or drums hold for their
// notes, so nothing plays ahead of them. The key changes when the audio should; '' loads nothing.

export interface AudioSourceInput {
  holding: boolean
  /** The stems artefact, when its channels are listed. */
  stemsId: string | undefined
  /** A file picked on this page (local-files). */
  local: boolean
  sourceKind: z.infer<typeof SourceKind> | undefined
  /** url_import's stage status, for a link. */
  download: string | undefined
  /** The song has an analysis (or this page's upload started one). */
  analysed: boolean
}

export function audioSourceKey({
  holding,
  stemsId,
  local,
  sourceKind,
  download,
  analysed,
}: AudioSourceInput): string {
  if (holding) return ''
  if (stemsId !== undefined) return `stems:${stemsId}`
  if (local) return 'local'
  // A file's audio exists once its analysis does; a link's once url_import has downloaded it. An
  // example song has no audio of its own, only its stems.
  const hasSource =
    sourceKind === 'url'
      ? download === 'done' || download === 'fallback'
      : sourceKind !== 'example' && analysed
  return hasSource ? 'source' : ''
}
