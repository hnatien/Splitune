import { createLucideIcon } from 'lucide-react'

// Its own module: the tick is drawn by `animate-check-draw`, which needs `pathLength` 1 and a
// one-unit dash on the path (Lucide's own icons carry neither). It plays when the icon mounts.
const DRAWN = 'animate-check-draw [stroke-dasharray:1]'

/** A tick that draws itself on mount (saved, pass felt clean). */
export const CheckDrawIcon = createLucideIcon('check-draw', [
  ['path', { d: 'M20 6 9 17l-5-5', pathLength: 1, className: DRAWN, key: 'tick' }],
])

/** Lucide's circle-check whose tick draws itself on mount (stage done). */
export const CircleCheckDrawIcon = createLucideIcon('circle-check-draw', [
  ['circle', { cx: '12', cy: '12', r: '10', key: 'ring' }],
  ['path', { d: 'm9 12 2 2 4-4', pathLength: 1, className: DRAWN, key: 'tick' }],
])
