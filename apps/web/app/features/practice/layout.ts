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
  // A desktop window narrowed to a phone's width gets the phone's arrangement, not a clipped one.
  if (!coarse) return narrow ? 'phone-portrait' : 'desktop'
  if (narrow && !landscape) return 'phone-portrait'
  if (short && landscape) return 'phone-landscape'
  return landscape ? 'tablet-landscape' : 'tablet-portrait'
}

export const isPhone = (layout: PracticeLayout) =>
  layout === 'phone-portrait' || layout === 'phone-landscape'

/** Under 1024 px one row can't hold the transport: it stacks into a status row over two rows
 * (27 §3.7.2), on a phone and on a tablet in portrait alike. */
export function useTransportStacked(layout: PracticeLayout) {
  const wide = useMediaQuery('(min-width: 1024px)', true)
  return isPhone(layout) || !wide
}

/** From 1180 px a fine-pointer screen has room to dock the tools panel beside the music
 * (27 §3.7.1); below that, and on touch layouts, the panel is a drawer or a sheet. */
export function usePanelDocked() {
  return useMediaQuery('(min-width: 1180px)', true)
}
