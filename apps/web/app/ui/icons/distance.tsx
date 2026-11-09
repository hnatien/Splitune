import type * as React from 'react'
import { cn } from '@/lib/utils'

// Distance illustrations (26 §11, `Onboarding.dc.html`): a seated player, the floor and the
// screen at Desk, Music stand or Floor distance, joined by a dashed line of sight. Line drawings
// in token colours (never amber: 26 §4.5), decorative: the card's title names the choice.

export type DistanceDrawing = 'desk' | 'stand' | 'floor'

// Screen position and size on the 200 × 90 canvas: a laptop close by, a tablet at arm's length
// on a stand, a phone far away on the floor.
const SCREENS: Record<DistanceDrawing, { x: number; y: number; width: number; height: number }> = {
  desk: { x: 74, y: 44, width: 46, height: 30 },
  stand: { x: 118, y: 30, width: 30, height: 40 },
  floor: { x: 168, y: 64, width: 16, height: 10 },
}

function DistanceIllustration({
  distance,
  className,
  ...props
}: React.ComponentProps<'svg'> & { distance: DistanceDrawing }) {
  const screen = SCREENS[distance]
  return (
    <svg
      viewBox="0 0 200 90"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      data-slot="distance-illustration"
      className={cn('h-22.5 w-full', className)}
      {...props}
    >
      <path d="M10 82H190" className="stroke-border-strong" />
      <circle cx={30} cy={34} r={10} className="stroke-muted-foreground" />
      <path d="M30 44V70M30 70l-8 12M30 70l8 12M30 52l14 8" className="stroke-muted-foreground" />
      <path d={`M44 62H${screen.x}`} strokeDasharray="4 4" className="stroke-faint-foreground" />
      <rect {...screen} rx={3} className="stroke-foreground" />
    </svg>
  )
}

export { DistanceIllustration }
