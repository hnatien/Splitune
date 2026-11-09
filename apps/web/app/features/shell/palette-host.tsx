import { lazy, Suspense } from 'react'

const CommandPalette = lazy(() => import('./command-palette'))

// One hop between the shells and the palette: the list of chunks the palette needs is emitted with
// this import, so the practice route only carries the launcher (D6).
export default function PaletteHost() {
  return (
    <Suspense>
      <CommandPalette />
    </Suspense>
  )
}
