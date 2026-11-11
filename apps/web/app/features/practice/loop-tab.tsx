import type { LoopClip } from '@splitune/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { z } from 'zod'
import { client, orpc } from '@/lib/api'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { Switch } from '@/ui/switch'
import { OptionSegments } from '../common/option-segments'
import { deleteClip, renameClip, useHiddenClips } from './clip-actions'
import { LadderCard } from './ladder-card'
import { barRange, type LoopRange, moveLoop, nudge, restSeconds } from './model/loops'
import type { RestBetween } from './model/player-machine'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The Loop tab (27 §3.7.4, Main.dc.html): "Bars 25–28" with the best clean pass, From bar / To bar
// steppers (one bar per step), Next phrase · ×2 · ÷2, "Fine-tune edges" with the sixteenth-note
// nudges, the Speed ladder card (ladder-card.tsx; only with `v1.speed_trainer` on), Between repeats
// (rest, count-in, "Ask how each pass went before the next"), Saved clips (a row per named clip
// with Rename and Delete in its More menu), and Clear loop. Before the beat is found: "Bar loops
// are ready once the beat is found." The same body opens from the loop badge's popover on tablets
// and phones.

type Clip = z.infer<typeof LoopClip>

const eyebrow = 'text-xs font-semibold tracking-wider text-faint-foreground uppercase'

export function LoopTab() {
  const practice = usePractice()
  const { player, grid, best } = practice
  const loop = player.loop
  if (!grid) {
    return <p className="text-sm text-muted-foreground">{m['practice.loop_needs_beats']()}</p>
  }
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {loop ? (
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl">
              {m['practice.loop_bars']({ bars: `${loop.startBar + 1}–${loop.endBar + 1}` })}
            </h2>
            {best !== null && (
              <p className="text-sm text-muted-foreground tabular-nums">
                {m['practice.best_tempo']({ pct: String(best) })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-md text-muted-foreground">{m['practice.loop_empty']()}</p>
        )}
        <LoopBars />
        {loop && <QuickMoves loop={loop} />}
        {loop && <FineTune loop={loop} />}
      </div>
      {loop && practice.ladderEnabled && <LadderCard />}
      {loop && <BetweenRepeats loop={loop} />}
      <SavedClips />
      {loop && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => {
            practice.setLoop(null)
            usePracticeUi.setState({ selection: { kind: 'none' } })
            practice.send({ type: 'SET_LOOP_ON', on: false })
          }}
        >
          <XIcon aria-hidden />
          {m['practice.clear_loop']()}
        </Button>
      )}
    </>
  )
}

// From bar / To bar (‹ 25 ›): one bar per step; typing a bar works too.
function LoopBars() {
  const practice = usePractice()
  const { grid, player } = practice
  const loop = player.loop
  if (!grid) return null
  const first = grid.firstBar + 1
  const last = grid.lastBar + 1
  const setBars = (from: number, to: number) =>
    practice.setLoop(barRange(grid, from - 1, to - 1), 'numeric')
  const edges = [
    {
      edge: 'start',
      label: m['practice.from_bar'](),
      earlier: m['practice.earlier_start'](),
      later: m['practice.later_start'](),
      value: loop ? loop.startBar + 1 : null,
      set: (value: number) => setBars(value, Math.max(value, (loop?.endBar ?? value - 1) + 1)),
    },
    {
      edge: 'end',
      label: m['practice.to_bar'](),
      earlier: m['practice.earlier_end'](),
      later: m['practice.later_end'](),
      value: loop ? loop.endBar + 1 : null,
      set: (value: number) => setBars(Math.min(value, (loop?.startBar ?? value - 1) + 1), value),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {edges.map(({ edge, label, earlier, later, value, set }) => (
        <div key={edge} className="flex min-w-0 flex-col gap-1.5">
          <span aria-hidden className="text-sm font-semibold text-muted-foreground">
            {label}
          </span>
          <NumberField
            fill
            value={value}
            min={first}
            max={last}
            step={1}
            inputLabel={label}
            decrementLabel={earlier}
            incrementLabel={later}
            onValueChange={(next) => next !== null && set(next)}
          />
        </div>
      ))}
    </div>
  )
}

// Next phrase (shift by the loop's own length), ×2 and ÷2.
function QuickMoves({ loop }: { loop: LoopRange }) {
  const practice = usePractice()
  const { grid } = practice
  if (!grid) return null
  const moves = [
    { move: 'next' as const, text: m['practice.next_phrase'](), label: undefined },
    { move: 'double' as const, text: '×2', label: m['practice.loop_double']() },
    { move: 'half' as const, text: '÷2', label: m['practice.loop_half']() },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {moves.map(({ move, text, label }) => {
        const next = moveLoop(grid, loop, move)
        return (
          <Button
            key={move}
            variant="secondary"
            size="sm"
            disabled={next === loop}
            className={cn(move !== 'next' && 'font-mono')}
            onClick={() => practice.setLoop(next, 'numeric')}
          >
            {label ? (
              <>
                <span aria-hidden>{text}</span>
                <span className="sr-only">{label}</span>
              </>
            ) : (
              text
            )}
          </Button>
        )
      })}
    </div>
  )
}

// "Fine-tune edges": each edge by a sixteenth note (12 §5).
function FineTune({ loop }: { loop: LoopRange }) {
  const practice = usePractice()
  const { grid } = practice
  if (!grid) return null
  const edges = [
    { edge: 'start' as const, name: m['practice.nudge_start']() },
    { edge: 'end' as const, name: m['practice.nudge_end']() },
  ]
  return (
    <details className="group/fine flex flex-col gap-2">
      <summary className="flex min-h-target-practice-2 cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronRightIcon
          aria-hidden
          className="size-4 transition-transform duration-(--duration-fast) group-open/fine:rotate-90"
        />
        {m['practice.fine_tune']()}
      </summary>
      <div className="flex flex-col gap-2 pl-6">
        {edges.map(({ edge, name }) => (
          <div key={edge} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm">{name}</span>
            <Button
              size="icon"
              variant="secondary"
              aria-label={m['practice.nudge_earlier']({ edge: name })}
              onClick={() => practice.setLoop(nudge(grid, loop, edge, -1))}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              aria-label={m['practice.nudge_later']({ edge: name })}
              onClick={() => practice.setLoop(nudge(grid, loop, edge, 1))}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">{m['practice.nudge_hint']()}</p>
      </div>
    </details>
  )
}

function BetweenRepeats({ loop }: { loop: LoopRange }) {
  const practice = usePractice()
  const { player, grid, send } = practice
  const passPrompt = usePracticeDefaults((s) => s.passPrompt)
  const update = usePracticeDefaults((s) => s.update)
  const promptId = useId()
  const rests: Record<RestBetween, string> = {
    none: m['settings.rest_none'](),
    beat: m['settings.rest_beat'](),
    bar: m['settings.rest_bar'](),
  }
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className={eyebrow}>{m['practice.loop_section_repeats']()}</h3>
      <OptionSegments
        label={m['settings.rest']()}
        value={player.rest}
        options={(['none', 'beat', 'bar'] as const).map((value) => ({
          value,
          label: rests[value],
        }))}
        onChange={(rest) => {
          send({ type: 'SET_REST', rest, restSeconds: restSeconds(grid ?? null, loop, rest) })
          if (practice.clip) {
            void client.loops.update({
              id: practice.songId,
              loop_id: practice.clip.id,
              rest_between: rest,
            })
          }
        }}
      />
      <OptionSegments
        label={m['settings.count_in']()}
        value={player.countIn ? String(player.countInBars) : '0'}
        options={['0', '1', '2'].map((value) => ({
          value,
          label:
            value === '0'
              ? m['settings.count_in_off']()
              : value === '1'
                ? m['settings.count_in_one_bar']()
                : m['settings.count_in_bars']({ bars: value }),
        }))}
        onChange={(value) => {
          const bars = Number(value)
          send({ type: 'SET_COUNT_IN', on: bars > 0, ...(bars > 0 ? { bars } : {}) })
          if (practice.clip) {
            void client.loops.update({
              id: practice.songId,
              loop_id: practice.clip.id,
              count_in_bars: bars,
            })
          }
        }}
      />
      <div className="flex min-h-target-practice-2 items-center gap-3">
        <Switch
          id={promptId}
          checked={passPrompt}
          onCheckedChange={(on) => {
            update({ passPrompt: on })
            send({ type: 'SET_ASSESS', on })
          }}
        />
        <Label htmlFor={promptId}>{m['practice.ask_after_pass']()}</Label>
      </div>
    </section>
  )
}

// Saved clips (27 §3.7.4): "Save this loop" names the loop being played; each named clip is a
// row (the amber dot on the one playing, name, "bars 25–28 · best 80 %") that loops it as it was
// left, with Rename and Delete in its More menu.
function SavedClips() {
  const practice = usePractice()
  const queryClient = useQueryClient()
  const clip = practice.clip
  const hidden = useHiddenClips((s) => s.ids)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const id = useId()
  const named = practice.clips.filter((c) => c.name !== null && !hidden.includes(c.id))
  const unsaved = clip !== undefined && clip.name === null
  if (!unsaved && named.length === 0) return null
  return (
    <section className="flex flex-col gap-1">
      <div className="flex min-h-target-practice-2 items-center justify-between gap-2">
        <h3 className={eyebrow}>{m['practice.clips']()}</h3>
        {unsaved && !naming && (
          <Button variant="ghost" size="sm" onClick={() => setNaming(true)}>
            {m['practice.save_this_loop']()}
          </Button>
        )}
      </div>
      {unsaved && naming && (
        <form
          className="flex items-end gap-2 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = name.trim()
            if (!trimmed) return
            void client.loops
              .update({ id: practice.songId, loop_id: clip.id, name: trimmed })
              .then(() => {
                setNaming(false)
                setName('')
                return queryClient.invalidateQueries({
                  queryKey: orpc.loops.list.queryKey({ input: { id: practice.songId } }),
                })
              })
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor={id}>{m['practice.clip_name']()}</Label>
            <Input
              id={id}
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={name.trim() === ''}>
            {m['practice.save_clip']()}
          </Button>
        </form>
      )}
      <ul className="flex flex-col">
        {named.map((c) => (
          <li key={c.id} className="flex items-center gap-1">
            {renaming === c.id ? (
              <RenameClip
                clip={c}
                onDone={(next) => {
                  setRenaming(null)
                  if (next) renameClip(queryClient, c, next)
                }}
              />
            ) : (
              <ClipRow
                clip={c}
                active={c.id === clip?.id}
                onRename={() => setRenaming(c.id)}
                onDelete={() => deleteClip(queryClient, c)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClipRow({
  clip,
  active,
  onRename,
  onDelete,
}: {
  clip: Clip
  active: boolean
  onRename: () => void
  onDelete: () => void
}) {
  const practice = usePractice()
  const bars = `${clip.start_bar + 1}–${clip.end_bar + 1}`
  return (
    <>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        className="flex min-h-target-practice-2 min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-2 text-left hover:bg-muted"
        onClick={() => practice.selectClip(clip)}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            active ? 'bg-signal' : 'bg-faint-foreground',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-md font-semibold">{clip.name}</span>
          <span className="font-mono text-sm text-faint-foreground tabular-nums">
            {clip.best_clean_tempo_pct === null
              ? m['practice.clip_bars']({ bars })
              : m['practice.clip_bars_best']({ bars, pct: String(clip.best_clean_tempo_pct) })}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={m['practice.clip_more']({ name: clip.name ?? '' })}
            />
          }
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onRename}>{m['practice.clip_rename']()}</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            {m['practice.clip_delete']()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

// The row's name as a field: Enter or "Save name" renames, Escape or leaving it empty keeps the
// old name.
function RenameClip({ clip, onDone }: { clip: Clip; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(clip.name ?? '')
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2 py-1"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(name.trim() || null)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onDone(null)
      }}
    >
      <Input
        ref={field}
        aria-label={m['practice.clip_rename_label']({ name: clip.name ?? '' })}
        className="min-w-0 flex-1"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={name.trim() === ''}>
        {m['practice.clip_rename_save']()}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => onDone(null)}>
        {m['common.cancel']()}
      </Button>
    </form>
  )
}
