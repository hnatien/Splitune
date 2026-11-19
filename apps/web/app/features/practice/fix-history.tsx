import { type Beats, type Chords, chordDisplayName, type Notes } from '@splitune/music-core'
import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { orpc } from '@/lib/api'
import { formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { chordText } from '@/ui/chord-chip'
import { Switch } from '@/ui/switch'
import { barLabel, eyebrow } from './fix-cards'
import { type Op, useCorrections } from './model/corrections'
import type { ArtefactEntry } from './model/data'
import { type Edit, revertOp, UNCONFIRM } from './model/edits'
import type { PracticeGrid } from './model/grid'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// EditHistory (26 §12.2, 27 §3.7.4): "Your edits" — every correction on this song, newest first,
// as "Changed a chord · bar 12 · F → Fmaj7 · 2 days ago" with a Revert that appends its inverse
// (the overlay is append-only), the "Show original" switch, and where the fixes go: "Your fixes
// are saved for this song." Nothing here says the model learns from them.

const OP_LABEL: Record<Op['op'], () => string> = {
  set_chord: () => m['history.set_chord'](),
  split_chord: () => m['history.split_chord'](),
  set_note: () => m['history.set_note'](),
  add_note: () => m['history.add_note'](),
  delete_note: () => m['history.delete_note'](),
  shift_downbeat: () => m['history.shift_downbeat'](),
  tempo_octave: () => m['history.tempo_octave'](),
  nudge_beat: () => m['history.nudge_beat'](),
  report_wrong: () => m['history.report_wrong'](),
  mark_correct: () => m['history.mark_correct'](),
  set_section: () => m['history.set_section'](),
}

const HOUR_MS = 3600 * 1000

/** Where an op's chord or note sounds (seconds), from the artefact it corrects. */
function opTime(op: Op, base: Chords | Notes | Beats | undefined): number | undefined {
  if (!base) return undefined
  if (op.op === 'split_chord') return op.at_s
  if (op.op === 'add_note') return op.note.onset_s
  const id =
    'segment_id' in op
      ? op.segment_id
      : 'note_id' in op
        ? op.note_id
        : 'entity_id' in op
          ? op.entity_id
          : undefined
  if (id === undefined) return undefined
  if ('segments' in base) {
    // A split's tail is named after the chord it came from (`{id}.{n}`).
    return base.segments.find((s) => s.id === id || id.startsWith(`${s.id}.`))?.t0
  }
  if ('notes' in base) return base.notes.find((n) => n.id === id)?.onset_s
  return undefined
}

function useRecords(entry: ArtefactEntry | undefined) {
  return useQuery({
    ...orpc.artefacts.listCorrections.queryOptions({ input: { id: entry?.id ?? '' } }),
    enabled: entry !== undefined,
  }).data?.ops
}

export function EditHistory() {
  const { data, artefactFor, grid, music, edit } = usePractice()
  const showOriginal = usePracticeUi((s) => s.showOriginal)
  const waiting = useCorrections((s) => s.offline)
  const titleId = useId()
  const switchId = useId()
  const records = {
    chords: useRecords(data.entry.chords),
    notes: useRecords(data.entry.notes),
    beats: useRecords(data.entry.beats),
  }
  const groups: { kind: Edit['kind']; base: Chords | Notes | Beats | undefined }[] = [
    { kind: 'chords', base: data.chords.data },
    // Drum hits have no edits yet (step 25), so only pitched notes have a history.
    {
      kind: 'notes',
      base: data.notes.data && 'notes' in data.notes.data ? data.notes.data : undefined,
    },
    { kind: 'beats', base: data.beats.data },
  ]
  const now = Date.now()
  const rows = groups
    .flatMap(({ kind, base }) =>
      data.ops[kind].ops.map((op, index) => {
        // Server ops come first, in rev order; this device's unsent ones follow.
        const sent = records[kind]?.[index]?.created_at
        return { kind, base, op, index, at: sent ? Date.parse(sent) : now, pending: !sent }
      }),
    )
    // A taken-back "It's right" is not an edit of its own.
    .filter(({ op }) => !(op.op === 'report_wrong' && op.comment === UNCONFIRM))
    .sort((a, b) => b.at - a.at || b.index - a.index)
  if (rows.length === 0) return null
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-0.5" data-slot="edit-history">
      <div className="flex items-center gap-2">
        <h3 id={titleId} className={`${eyebrow} flex-1`}>
          {m['edit.history']()}
        </h3>
        <label htmlFor={switchId} className="text-sm text-muted-foreground">
          {m['fix.show_original']()}
        </label>
        <Switch
          id={switchId}
          checked={showOriginal}
          onCheckedChange={(checked) => usePracticeUi.setState({ showOriginal: checked })}
        />
      </div>
      <ol className="flex flex-col">
        {rows.map(({ kind, base, op, index, at, pending }) => {
          const inverse = base ? revertOp(kind, base, data.ops[kind].ops, index) : null
          const target = artefactFor(kind)
          return (
            <li key={`${kind}-${index}`} className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1 text-sm tabular-nums">
                {describe(op, inverse, base, grid, music?.noteNames)}
              </span>
              {pending && waiting ? (
                <Badge variant="neutral">{m['fix.saved_device']()}</Badge>
              ) : (
                <span className="shrink-0 text-sm text-faint-foreground">
                  {now - at < HOUR_MS ? m['fix.just_now']() : formatRelativeDate(new Date(at))}
                </span>
              )}
              {inverse && target && !showOriginal ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => edit({ kind, op: inverse, inverse: op })}
                >
                  {m['edit.revert']()}
                </Button>
              ) : (
                <span aria-hidden className="h-control" />
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-muted-foreground">{m['practice.fix_saved_note']()}</p>
    </section>
  )
}

/** "Changed a chord · bar 12 · F → Fmaj7": what happened, where, and for a chord what changed. */
function describe(
  op: Op,
  inverse: Op | null,
  base: Chords | Notes | Beats | undefined,
  grid: PracticeGrid | undefined,
  names: readonly string[] | undefined,
): string {
  const time = opTime(op, base)
  const parts = [OP_LABEL[op.op]()]
  if (time !== undefined && grid) {
    parts.push(m['fix.detail_bar']({ bar: barLabel(grid.positionAt(time + 1e-6).bar) }))
  }
  if (op.op === 'set_chord' && inverse?.op === 'set_chord') {
    parts.push(
      m['fix.change']({
        from: chordText(chordDisplayName(inverse.label, inverse.bass, names)),
        to: chordText(chordDisplayName(op.label, op.bass, names)),
      }),
    )
  }
  return parts.join(' · ')
}
