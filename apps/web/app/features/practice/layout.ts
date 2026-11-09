import { useMediaQuery } from '@/lib/use-media-query'

// Practice layouts (27 §3.7, 26 §7): from viewport size, orientation and the pointer — feature
// queries, never the user agent.
export type PracticeLayout =
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'phone-landscape'
  | 'phone-portrait'
  | 'desktop'

export function usePracticeLayout(): PracticeLayout {
  const coarse = useMediaQuery('(pointer: coarse)', false)
  const narrow = useMediaQuery('(max-width: 640px)', false)
  const short = useMediaQuery('(max-height: 640px)', false)
  const landscape = useMediaQuery('(orientation: landscape)', true)
  if (!coarse) return 'desktop'
  if (narrow && !landscape) return 'phone-portrait'
  if (short && landscape) return 'phone-landscape'
  return landscape ? 'tablet-landscape' : 'tablet-portrait'
}

export const isPhone = (layout: PracticeLayout) =>
  layout === 'phone-portrait' || layout === 'phone-landscape'

/**
 * Desktop region behaviour by width (27 §3.7.1, fine pointer): from 1180 px the inspector is
 * docked; below it the inspector is a drawer opened from "Tools"; below 1024 px the Now column
 * also becomes a strip above the notation. Below 1440 px (the width `Main.dc.html` is drawn at) the
 * dock's mix pill keeps only its icon and the volume moves into a popover (26 §7), so the loop pill
 * keeps its words.
 */
export function useDesktopRegions() {
  const docked = useMediaQuery('(min-width: 1180px)', true)
  const column = useMediaQuery('(min-width: 1024px)', true)
  const roomy = useMediaQuery('(min-width: 1440px)', true)
  return { docked, nowColumn: column, roomyDock: roomy }
}
