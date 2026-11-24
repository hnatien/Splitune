import { FileAudioIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'

// A file dragged anywhere over the app shell (27 §1): the whole window becomes the drop target, a
// raised layer with the 2 px ink edge, "Drop to add" and what it takes (formats, up to 20 min),
// and the drop opens Add song with the file. Choosing a file in Add song is the non-drag path
// (WCAG 2.5.7).
export function DropOverlay({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) onFile(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])
  if (!dragging) return null
  return (
    <div
      data-slot="drop-overlay"
      className="pointer-events-none fixed inset-0 z-(--z-popover) flex bg-scrim p-3 sm:p-4"
    >
      <div
        role="status"
        className="flex flex-1 animate-pop-in flex-col items-center justify-center gap-3 rounded-dialog border-2 border-selected bg-raised px-6 text-center shadow-dialog"
      >
        <FileAudioIcon aria-hidden strokeWidth={1.8} className="size-8 text-muted-foreground" />
        <p className="text-heading">{m['import.drop_here']()}</p>
        <p className="text-body-sm text-muted-foreground">{m['import.formats']()}</p>
      </div>
    </div>
  )
}
