import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'

// A file dragged anywhere over the app shell (27 §1): "Drop to add" over the page, and the drop
// opens Add song with the file. Choosing a file in Add song is the non-drag path (WCAG 2.5.7).
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
      className="pointer-events-none fixed inset-0 z-(--z-popover) grid place-items-center bg-scrim p-4"
    >
      <p
        role="status"
        className="grid min-h-56 w-full max-w-xl place-items-center rounded-4xl border-2 border-solid border-signal bg-card px-6 text-xl"
      >
        {m['import.drop_here']()}
      </p>
    </div>
  )
}
