import { useCallback, useState } from 'react'
import { client } from '@/lib/api'
import { hashFile } from './hash'
import { decodeLocally, type LocalAudio } from './local-audio'
import { isBlocking, MAX_BYTES, type PreflightIssue, preflight } from './preflight'

// A picked file on its way to import: hashed in a Worker (duplicate check before any song is
// created), decoded locally for the preview and the pre-flight checks, in parallel.

export type PickedFile = {
  file: File
  status: 'reading' | 'ready'
  sha256?: string | undefined
  audio?: LocalAudio | undefined
  issues: PreflightIssue[]
  duplicateOf?: string | undefined
  /** The file can't be hashed or decoded here at all. */
  unreadable: boolean
}

export function usePickedFile() {
  const [picked, setPicked] = useState<PickedFile | undefined>()

  const pick = useCallback(async (file: File) => {
    const initial: PickedFile = {
      file,
      status: 'reading',
      issues: preflight(file.size, undefined),
      unreadable: false,
    }
    setPicked(initial)
    if (file.size > MAX_BYTES) {
      setPicked({ ...initial, status: 'ready' })
      return
    }
    const [sha256, audio] = await Promise.all([
      hashFile(file).catch(() => undefined),
      decodeLocally(file).catch((): LocalAudio => ({ kind: 'unreadable' })),
    ])
    const duplicate = sha256
      ? await client.uploads.lookup({ file_sha256: sha256 }).catch(() => ({ song_id: null }))
      : { song_id: null }
    setPicked((current) =>
      current?.file === file
        ? {
            file,
            status: 'ready',
            sha256,
            audio,
            issues: preflight(file.size, audio.kind === 'decoded' ? audio.stats : undefined),
            duplicateOf: duplicate.song_id ?? undefined,
            unreadable: !sha256 || audio.kind === 'unreadable',
          }
        : current,
    )
  }, [])

  const clear = useCallback(() => setPicked(undefined), [])

  const blocked = picked
    ? picked.unreadable || picked.issues.some(isBlocking) || picked.status !== 'ready'
    : true
  return { picked, pick, clear, blocked }
}
