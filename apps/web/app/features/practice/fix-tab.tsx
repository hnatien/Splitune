import { Link } from '@tanstack/react-router'
import { PencilRulerIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { PanelSection } from '@/ui/panel'
import { Status } from '@/ui/status'
import { EditorContent } from './editor-content'
import { BeatFixes, barsLabel, SpotHeader } from './fix-cards'
import { EditHistory } from './fix-history'
import { stepSelection, useFixQueue } from './fix-mode'
import { useFix } from './fix-store'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The Fix tab (27 §3.7.4; s47 direction §7): the spot header (where the selection sits in the
// queue, K / J), the selected spot's chord and note sections, the metronome fixes and Your edits,
// divided by hairlines. With nothing marked unsure it says so with the ready glyph; the metronome
// fixes and the history stay. The arrows step through the spots while focus is in the tab (not in
// a field), as J / K and the pedal do everywhere.
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
  // alternatives, It's right for a note or a shaky bar, in the section the spot is about. A
  // selection with nothing to confirm leaves focus where it is. The tab may still be on its way in
  // (its panel takes focus only once it is shown), so the hand-off is tried for a few frames.
  const root = useRef<HTMLDivElement>(null)
  const focus = useFix((s) => s.focus)
  useEffect(() => {
    if (!focus) return
    let frame = 0
    let tries = 0
    const hand = () => {
      const cards = root.current?.querySelector('[data-slot=editor]')
      const first = cards?.querySelector<HTMLElement>('[data-fix-focus]')
      first?.focus()
      if ((cards && !first) || (first && document.activeElement === first) || ++tries > 30) {
        useFix.setState({ focus: false })
      } else frame = requestAnimationFrame(hand)
    }
    hand()
    return () => cancelAnimationFrame(frame)
  }, [focus])

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
    <div
      ref={root}
      data-slot="fix-tab"
      className="flex flex-col [&>section:first-child]:pt-0"
      onKeyDown={onKeyDown}
    >
      {queue.length === 0 && !target ? (
        <PanelSection>
          <Status kind="ready" className="text-body-sm text-foreground">
            {empty}
          </Status>
        </PanelSection>
      ) : (
        <PanelSection className="pb-4">
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
        </PanelSection>
      )}
      {showOriginal ? (
        <PanelSection>
          <Status kind="paused" className="text-body-sm [&>span:last-child]:whitespace-normal">
            {m['fix.showing_original']()}
          </Status>
        </PanelSection>
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
        <PanelSection>
          <Link
            to="/songs/$songId/edit"
            params={{ songId }}
            className={buttonVariants({ variant: 'quiet', className: 'self-start' })}
          >
            <PencilRulerIcon aria-hidden />
            {m['fix.open_editor']()}
          </Link>
        </PanelSection>
      )}
    </div>
  )
}
