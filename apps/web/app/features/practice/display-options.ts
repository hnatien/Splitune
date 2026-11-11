import type { FollowMode, PianoHands, PlayheadStyle } from '@/lib/display-store'
import { m } from '@/lib/i18n'

// Names of the display store's options (lib/display-store.ts exports the lists), shared by the
// practice Display popover and Settings → Display & practice so both offer the same words.

export function followLabel(mode: FollowMode): string {
  switch (mode) {
    case 'page':
      return m['practice.follow_page']()
    case 'scroll':
      return m['practice.follow_scroll']()
    case 'off':
      return m['practice.follow_off']()
  }
}

export function playheadLabel(style: PlayheadStyle): string {
  switch (style) {
    case 'line':
      return m['practice.playhead_line']()
    case 'block':
      return m['practice.playhead_block']()
    case 'bar':
      return m['practice.playhead_bar']()
  }
}

export function handsLabel(hands: PianoHands): string {
  switch (hands) {
    case 'both':
      return m['practice.hands_both']()
    case 'left':
      return m['practice.hands_left']()
    case 'right':
      return m['practice.hands_right']()
  }
}
