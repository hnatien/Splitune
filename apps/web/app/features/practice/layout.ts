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
