import type { LoopClip } from '@splitune/contracts'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { create } from 'zustand'
import { client, orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { toast } from '@/ui/toast'

// Rename and Delete for saved clips (27 §3.7.4, 26 §8, §13): both are undoable rather than
// confirmed. A rename is optimistic with an Undo toast and rolls back if the server refuses. A
// delete hides the clip at once and is sent when its Undo toast closes (or the page goes), so
// Undo brings back the very same clip, best clean pass included.

type Clip = z.infer<typeof LoopClip>

const listKey = (songId: string) => orpc.loops.list.queryKey({ input: { id: songId } })

function patchList(queryClient: QueryClient, songId: string, change: (items: Clip[]) => Clip[]) {
  queryClient.setQueryData(listKey(songId), (list: { items: Clip[] } | undefined) =>
    list ? { items: change(list.items) } : list,
  )
}

const failed = () => toast.add({ title: m['practice.clip_failed'](), type: 'error' })

function saveName(queryClient: QueryClient, clip: Clip, name: string, undoTo?: string) {
  patchList(queryClient, clip.song_id, (items) =>
    items.map((c) => (c.id === clip.id ? { ...c, name } : c)),
  )
  void client.loops.update({ id: clip.song_id, loop_id: clip.id, name }).then(
    () => {
      if (undoTo === undefined) return
      const id = toast.add({
        title: m['practice.clip_renamed']({ name }),
        actionProps: {
          children: m['practice.clip_undo'](),
          onClick: () => {
            toast.close(id)
            saveName(queryClient, clip, undoTo)
          },
        },
      })
    },
    () => {
      patchList(queryClient, clip.song_id, (items) =>
        items.map((c) => (c.id === clip.id ? { ...c, name: clip.name } : c)),
      )
      failed()
    },
  )
}

/** Renames a clip now, with Undo back to the old name. */
export function renameClip(queryClient: QueryClient, clip: Clip, name: string) {
  if (clip.name === null || name === clip.name) return
  saveName(queryClient, clip, name, clip.name)
}

/** Clips whose delete is waiting for its Undo toast: hidden from the list meanwhile. */
export const useHiddenClips = create<{ ids: readonly string[] }>(() => ({ ids: [] }))

const show = (id: string) =>
  useHiddenClips.setState((state) => ({ ids: state.ids.filter((hidden) => hidden !== id) }))

const waiting = new Map<string, () => void>()

function sendWaiting() {
  for (const send of [...waiting.values()]) send()
}

/** Hides a clip and deletes it once its Undo toast closes; Undo shows it again, untouched. */
export function deleteClip(queryClient: QueryClient, clip: Clip) {
  if (waiting.size === 0) window.addEventListener('pagehide', sendWaiting)
  useHiddenClips.setState((state) => ({ ids: [...state.ids, clip.id] }))
  const send = () => {
    if (!waiting.delete(clip.id)) return
    void client.loops.delete({ id: clip.song_id, loop_id: clip.id }).then(
      () => {
        patchList(queryClient, clip.song_id, (items) => items.filter((c) => c.id !== clip.id))
        show(clip.id)
      },
      () => {
        show(clip.id)
        failed()
      },
    )
  }
  waiting.set(clip.id, send)
  const id = toast.add({
    title: m['practice.clip_deleted']({ name: clip.name ?? '' }),
    onClose: send,
    actionProps: {
      children: m['practice.clip_undo'](),
      onClick: () => {
        waiting.delete(clip.id)
        show(clip.id)
        toast.close(id)
      },
    },
  })
}
