import type * as React from 'react'
import { useEffect } from 'react'
import { create } from 'zustand'

// Command palette state (27 §3.12): whether it is open, and the actions screens register while they
// are mounted. Practice (s35) registers its clips, "Loop bars a–b", the view switches and "Display
// and reading" with `usePaletteActions`; the palette itself loads lazily (D6), this module doesn't.

export type PaletteGroup = 'clips' | 'actions'

export type PaletteAction = {
  id: string
  /** Shown and searched; the typed text is bold in it. */
  label: string
  /** Faint context after the label ("· Northbound Lights · bars 25–28"). */
  context?: string | undefined
  /** Extra words that find the action without being shown. */
  keywords?: string[] | undefined
  /** Its key, where it has one ("L"). */
  kbd?: string | undefined
  icon?: React.ReactNode
  run: () => void
  /**
   * Turns typed text into a row of its own, e.g. "loop 17-20" → "Loop bars 17–20" (see
   * `parseLoopQuery`). Undefined when the text doesn't apply; the action is then matched by label.
   */
  parse?: ((query: string) => { label: string; run: () => void } | undefined) | undefined
}

type PaletteState = {
  open: boolean
  setOpen: (open: boolean) => void
  registered: Record<string, { group: PaletteGroup; actions: PaletteAction[] }>
}

export const usePalette = create<PaletteState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  registered: {},
}))

let next = 0

/** Adds a screen's actions to the palette while the calling component is mounted. */
export function usePaletteActions(group: PaletteGroup, actions: PaletteAction[]) {
  useEffect(() => {
    const key = String(next++)
    usePalette.setState((s) => ({ registered: { ...s.registered, [key]: { group, actions } } }))
    return () =>
      usePalette.setState((s) => {
        const { [key]: _gone, ...rest } = s.registered
        return { registered: rest }
      })
  }, [group, actions])
}

/** "loop 17-20", "loop 17–20", "Loop 3 - 4" → bars 17 to 20 (1-based, as typed). */
export function parseLoopQuery(query: string): { start: number; end: number } | undefined {
  const match = /^\s*loop\s+(\d{1,4})\s*[-–]\s*(\d{1,4})\s*$/i.exec(query)
  if (!match) return undefined
  const start = Number(match[1])
  const end = Number(match[2])
  return start >= 1 && end >= start ? { start, end } : undefined
}
