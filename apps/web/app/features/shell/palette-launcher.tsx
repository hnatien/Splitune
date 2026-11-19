import { lazy, Suspense, useEffect } from 'react'
import { usePalette } from './palette-store'

const PaletteHost = lazy(() => import('./palette-host'))

// ⌘K / Ctrl K anywhere in the app and focus shells (27 §1, §3.12). The palette's code loads on the
// first open, so the practice route only carries this listener (D6).
export function PaletteLauncher() {
  const open = usePalette((s) => s.open)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey)
        return
      event.preventDefault()
      usePalette.getState().setOpen(!usePalette.getState().open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return open ? (
    <Suspense>
      <PaletteHost />
    </Suspense>
  ) : null
}
