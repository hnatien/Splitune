import { createLucideIcon } from 'lucide-react'

// Custom music icons on Lucide's grid (24 px, 2 px stroke, round caps), doc 26 §11. Like Lucide
// icons they are decorative: the control that uses one carries the text or aria-label.

/** Foot pedal (page-turner / footswitch) — keyboard & pedal settings, PedalHud. */
export const PedalIcon = createLucideIcon('pedal', [
  ['path', { d: 'M3 20h18', key: 'base' }],
  ['path', { d: 'M5 17 7.5 9h9l2.5 8Z', key: 'plate' }],
  ['path', { d: 'M12 9V5', key: 'stem' }],
  ['path', { d: 'M10 5h4', key: 'switch' }],
])

/** Capo clamped across the neck. */
export const CapoIcon = createLucideIcon('capo', [
  ['path', { d: 'M3 9h18', key: 'string-top' }],
  ['path', { d: 'M3 15h18', key: 'string-bottom' }],
  ['path', { d: 'M9 5v14', key: 'bar' }],
  ['path', { d: 'M9 5c4.5 0 7 2.5 7 7s-2.5 7-7 7', key: 'clamp' }],
])

/** Tab staff: lines with the opening bar line. */
export const TabStaffIcon = createLucideIcon('tab-staff', [
  ['path', { d: 'M3 5v14', key: 'barline' }],
  ['path', { d: 'M3 6h18', key: 'line-1' }],
  ['path', { d: 'M3 10h18', key: 'line-2' }],
  ['path', { d: 'M3 14h18', key: 'line-3' }],
  ['path', { d: 'M3 18h18', key: 'line-4' }],
])

/** Chord box (fretboard diagram) with one fingered note. */
export const ChordBoxIcon = createLucideIcon('chord-box', [
  ['rect', { x: '5', y: '3', width: '14', height: '18', rx: '1', key: 'frame' }],
  ['path', { d: 'M9.7 3v18', key: 'string-1' }],
  ['path', { d: 'M14.3 3v18', key: 'string-2' }],
  ['path', { d: 'M5 9h14', key: 'fret-1' }],
  ['path', { d: 'M5 15h14', key: 'fret-2' }],
  ['circle', { cx: '14.3', cy: '12', r: '1.5', key: 'finger' }],
])

/** Count-in "1-2-3-4": four beats, the first accented. */
export const CountInIcon = createLucideIcon('count-in', [
  ['circle', { cx: '4.5', cy: '12', r: '2.5', key: 'beat-1' }],
  ['circle', { cx: '10', cy: '12', r: '1.5', key: 'beat-2' }],
  ['circle', { cx: '15', cy: '12', r: '1.5', key: 'beat-3' }],
  ['circle', { cx: '20', cy: '12', r: '1.5', key: 'beat-4' }],
])

/** Minus-one: a stem with a slash through it (your part removed from the mix). */
export const MinusOneIcon = createLucideIcon('minus-one', [
  ['path', { d: 'M6 9v6', key: 'bar-1' }],
  ['path', { d: 'M10 6v12', key: 'bar-2' }],
  ['path', { d: 'M14 8v8', key: 'bar-3' }],
  ['path', { d: 'M18 10v4', key: 'bar-4' }],
  ['path', { d: 'm4 4 16 16', key: 'slash' }],
])

/** Your part: a stem with the left rule that marks it in the mixer. */
export const YourPartIcon = createLucideIcon('your-part', [
  ['path', { d: 'M4 4v16', key: 'rule' }],
  ['path', { d: 'M9 9v6', key: 'bar-1' }],
  ['path', { d: 'M13 5v14', key: 'bar-2' }],
  ['path', { d: 'M17 8v8', key: 'bar-3' }],
  ['path', { d: 'M21 10v4', key: 'bar-4' }],
])

export const CUSTOM_ICONS = {
  PedalIcon,
  CapoIcon,
  TabStaffIcon,
  ChordBoxIcon,
  CountInIcon,
  MinusOneIcon,
  YourPartIcon,
}
