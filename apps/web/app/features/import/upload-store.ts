import { create } from 'zustand'

// Browser uploads in progress, by song (10 §3: ephemeral UI state). The practice route shows the
// song's progress pill; the app and focus shells show the newest one.

export type UploadPhase =
  /** The page reloaded and this browser couldn't keep the file: the learner picks it again. */
  | 'needs_file'
  | 'waiting_online'
  | 'uploading'
  | 'completing'
  | 'starting_analysis'
  | 'done'
  | 'failed'

export type UploadItem = {
  songId: string
  title: string
  phase: UploadPhase
  bytesUploaded: number
  bytesTotal: number
  analysisId?: string | undefined
  /** Contract error code of the step that failed (27 §5.6 maps it to copy). */
  errorCode?: string | undefined
  errorData?: Record<string, unknown> | undefined
}

type UploadStore = {
  items: Record<string, UploadItem>
  upsert: (songId: string, patch: Partial<UploadItem> & Pick<UploadItem, 'title'>) => void
  patch: (songId: string, patch: Partial<UploadItem>) => void
  remove: (songId: string) => void
}

export const useUploads = create<UploadStore>()((set) => ({
  items: {},
  upsert: (songId, patch) =>
    set((state) => ({
      items: {
        ...state.items,
        [songId]: {
          songId,
          phase: 'uploading',
          bytesUploaded: 0,
          bytesTotal: 0,
          ...state.items[songId],
          ...patch,
        },
      },
    })),
  patch: (songId, patch) =>
    set((state) => {
      const current = state.items[songId]
      return current ? { items: { ...state.items, [songId]: { ...current, ...patch } } } : state
    }),
  remove: (songId) =>
    set((state) => {
      const { [songId]: _removed, ...rest } = state.items
      return { items: rest }
    }),
}))

export function uploadPercent(item: UploadItem): number {
  return item.bytesTotal > 0 ? Math.floor((item.bytesUploaded / item.bytesTotal) * 100) : 0
}
