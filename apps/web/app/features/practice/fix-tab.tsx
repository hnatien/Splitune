import { Link } from '@tanstack/react-router'
import { PencilRulerIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { EditorContent } from './editor-content'
import { BeatFixes, barsLabel, SpotHeader } from './fix-cards'
import { EditHistory } from './fix-history'
import { stepSelection, useFixQueue } from './fix-mode'
import { useFix } from './fix-store'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The Fix tab (27 §3.7.4, Practice-Fix.dc.html): the spot header, the selected spot's chord and
// note cards, the metronome fixes and Your edits. With nothing marked unsure it says so; the
// metronome fixes and the history stay. The arrows step through the spots while focus is in the
// tab (not in a field), as J / K do everywhere.
export function FixTab({
  fullEditor = true,
  empty = m['practice.fix_empty'](),
}: {
  /** "Open full editor" at the end (not in the full editor itself). */
  fullEditor?: boolean
  /** What to say with no spot and nothing selected. */
  empty?: string
}) {
  const { songId, guest } = usePractice()
  const target = usePracticeUi((s) => s.editor)
  const showOriginal = usePracticeUi((s) => s.showOriginal)
  const { queue, spot, position } = useFixQueue()

  // A selection made by key (J / K / E) puts focus on its first action: Hear for a chord with
  // alternatives, It's right for a note or a shaky bar. A selection with nothing to confirm leaves focus where it is.
  // The tab may still be on its way in (its panel takes focus only once it is shown), so the
  // hand-off is tried for a few frames.
  const root = useRef<HTMLDivElement>(null)
  // The card the selection is about: a chord spot's chord, else the note (or shaky bar).
  const card = spot?.kind === 'chord' ? 'chord-card' : 'note-card'
  const focus = useFix((s) => s.focus)
  useEffect(() => {
    if (!focus) return
    let frame = 0
    let tries = 0
    const hand = () => {
      const cards = root.current?.querySelector('[data-slot=editor]')
      const first =
        root.current?.querySelector<HTMLElement>(`[data-slot=${card}] [data-fix-primary]`) ??
        root.current?.querySelector<HTMLElement>('[data-fix-primary]')
      first?.focus()
      if ((cards && !first) || (first && document.activeElement === first) || ++tries > 30) {
        useFix.setState({ focus: false })
      } else frame = requestAnimationFrame(hand)
    }
    hand()
    return () => cancelAnimationFrame(frame)
  }, [focus, card])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (direction === 0 || event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement).closest('input, [role="switch"], [role="group"]')) return
    // The tab's arrows are its own: the transport's ← / → stay out while focus is here.
    event.preventDefault()
    event.stopPropagation()
    stepSelection(queue, spot, direction)
  }

  const bars = target ? barsLabel(target.bar, target.endBar) : ''
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys for the controls inside, which keep their own roles
    <div ref={root} data-slot="fix-tab" className="flex flex-col gap-3.5" onKeyDown={onKeyDown}>
      {queue.length === 0 && !target ? (
        <p className="text-label text-muted-foreground">{empty}</p>
      ) : (
        <SpotHeader
          title={
            spot
              ? m['fix.spot']({ n: String(position), total: String(queue.length), bars })
              : target && target.bar < 0 && !target.endBar
                ? m['practice.pickup']()
                : m['fix.bar_one']({ bar: bars })
          }
          position={position}
          total={queue.length}
          onStep={(direction) => stepSelection(queue, spot, direction)}
        />
      )}
      {showOriginal ? (
        <p className="text-body-sm text-muted-foreground">{m['fix.showing_original']()}</p>
      ) : (
        target && (
          <EditorContent
            bar={target.bar}
            endBar={target.endBar}
            chordId={target.chordId}
            noteId={target.noteId}
          />
        )
      )}
      {!showOriginal && <BeatFixes />}
      <EditHistory />
      {fullEditor && !guest && (
        <Link
          to="/songs/$songId/edit"
          params={{ songId }}
          className={buttonVariants({ variant: 'quiet', size: 'sm', className: 'self-start' })}
        >
          <PencilRulerIcon aria-hidden />
          {m['fix.open_editor']()}
        </Link>
      )}
    </div>
  )
}
