import { type PianoVoicing, voiceChords } from '@splitune/music-core'
import { useMemo } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { chordText } from '@/ui/chord-chip'
import type { ChordModel } from './model/view-model'
import { usePractice } from './practice-context'

// The keyboard's voicings for the chart's chords (piano strip, glance view): one per chord, each
// smooth one led from the chord before, with the hands the learner chose; notes named in the
// song's key. Loads with those views, outside the route's JS budget (12 §10).

export interface ShownVoicing extends PianoVoicing {
  /** "E♭", "G B♭ D". */
  leftText: string
  rightText: string
  /** The keyboard's accessible name. */
  label: string
}

export function usePianoVoicings(): (ShownVoicing | null)[] {
  const { view, music } = usePractice()
  const style = usePracticeDefaults((s) => s.pianoVoicing)
  const hands = usePracticeDefaults((s) => s.pianoHands)
  const names = music?.noteNames
  return useMemo(() => {
    const chords: readonly ChordModel[] = view?.chords ?? []
    const text = (notes: readonly number[]) =>
      notes.map((n) => chordText(names?.[n % 12] ?? '')).join(' ')
    return voiceChords(chords, style).map((voicing, i) => {
      if (!voicing) return null
      const left = hands === 'both' ? voicing.left : []
      const chord = chordText((chords[i] as ChordModel).name)
      const leftText = text(left)
      const rightText = text(voicing.right)
      return {
        left,
        right: voicing.right,
        leftText,
        rightText,
        label:
          left.length > 0
            ? m['practice.voicing_label']({ chord, left: leftText, right: rightText })
            : m['practice.voicing_label_right']({ chord, right: rightText }),
      }
    })
  }, [view, names, style, hands])
}
