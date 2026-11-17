import { create } from 'zustand'

// What Fix mode keeps to itself (27 §3.7.4): the alternative being heard over the loop, the chord
// change "Replace all in this song" can repeat, and the Fix dock's own speed, which the learner's
// practice speed never takes on.

export interface Audition {
  chordId: string
  /** Harte label of the alternative. */
  label: string
}

export interface Replaceable {
  /** The changed segment and what it was. */
  from: { id: string; label: string; bass: string | undefined }
  to: { label: string; bass?: string | undefined }
  /** Both chords as shown ("Am", "Am7"). */
  fromName: string
  toName: string
}

interface FixStore {
  audition: Audition | null
  replaceable: Replaceable | null
  speedPct: number | null
  /** A key chose the selection: its first action takes focus once its cards are drawn. */
  focus: boolean
}

export const useFix = create<FixStore>()(() => ({
  audition: null,
  replaceable: null,
  speedPct: null,
  focus: false,
}))
