import type { LoopClip } from '@splitune/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, RepeatIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { z } from 'zod'
import { client, orpc } from '@/lib/api'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Input } from '@/ui/input'
import { Kbd } from '@/ui/kbd'
import { Label } from '@/ui/label'
import { ListRow } from '@/ui/list-row'
import { NumberField } from '@/ui/number-field'
import { PanelSection } from '@/ui/panel'
import { Status } from '@/ui/status'
import { OptionSegments } from '../common/option-segments'
import { SwitchRow } from '../common/switch-row'
import { deleteClip, renameClip, useHiddenClips } from './clip-actions'
import { keyLabel } from './input-mapper'
import { LadderCard } from './ladder-card'
import { barRange, type LoopRange, moveLoop, nudge, restSeconds } from './model/loops'
import type { RestBetween } from './model/player-machine'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The Loop tab (27 §3.7.4; s47 direction §3, §7): the loop's bars with its best clean pass and
// the loop switch (L); Bars (From / To steppers, the length 1 · 2 · 4 · 8 with ÷2 and ×2, moving
// the loop by its own length with Shift ← / →, "Fine-tune edges" by sixteenths); the Speed ladder
// (ladder-card.tsx; only with `v1.speed_trainer` on); Between repeats (rest, count-in with I, and
// "Ask how each pass went", answered with C / N or the pedal); Saved clips as hairline rows, the
// one playing marked by the ink edge, with Rename and Delete in its ⋯ menu; Clear loop. Sections
// are set apart by hairlines, never boxed. Before the beat is found it says what it waits for.

type Clip = z.infer<typeof LoopClip>

const LENGTHS = [1, 2, 4, 8] as const

const lengthOf = (loop: LoopRange) => loop.endBar - loop.startBar + 1

export function LoopTab() {
  const practice = usePractice()
  const { player, grid } = practice
  const loop = player.loop
  if (!grid) {
    return (
      <div data-slot="loop-tab" className="flex flex-col gap-4">
        <Status kind="queued">{m['practice.loop_needs_beats']()}</Status>
        <SavedClips />
      </div>
    )
  }
  return (
    <div data-slot="loop-tab" className="flex flex-col [&>section:first-child]:pt-0">
      <LoopHead />
      <PanelSection title={m['practice.loop_section_bars']()}>
        <LoopBars />
        {loop && <Length loop={loop} />}
        {loop && <Move loop={loop} />}
        {loop && <FineTune loop={loop} />}
      </PanelSection>
      {loop && practice.ladderEnabled && <LadderCard />}
      {loop && <BetweenRepeats loop={loop} />}
      <SavedClips />
      {loop && (
        <PanelSection>
          <Button
            variant="quiet"
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
        </PanelSection>
      )}
    </div>
  )
}

// "Bars 25–28 · Best clean pass 70 %" and the loop switch (L), or how to make a loop.
function LoopHead() {
  const { player, best, send } = usePractice()
  const loop = player.loop
  return (
    <section data-slot="loop-head" className="flex items-center gap-3 pb-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {loop ? (
          <>
            <h2 className="text-title tabular-nums">
              {m['practice.loop_bars']({ bars: `${loop.startBar + 1}–${loop.endBar + 1}` })}
            </h2>
            <p className="text-body-sm text-muted-foreground tabular-nums">
              {best !== null
                ? m['practice.best_tempo']({ pct: String(best) })
                : player.loopOn
                  ? m['practice.hud_loop_on']()
                  : m['practice.hud_loop_off']()}
            </p>
          </>
        ) : (
          <p className="text-body-sm text-muted-foreground">{m['practice.loop_empty']()}</p>
        )}
      </div>
      {loop && (
        <Button
          variant={player.loopOn ? 'selected' : 'outline'}
          size="practice"
          aria-pressed={player.loopOn}
          shortcut="L"
          onClick={() => send({ type: 'SET_LOOP_ON', on: !player.loopOn })}
        >
          <RepeatIcon aria-hidden />
          {m['practice.loop']()}
        </Button>
      )}
    </section>
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
    <div className="grid grid-cols-2 gap-3">
      {edges.map(({ edge, label, earlier, later, value, set }) => (
        <div key={edge} className="flex min-w-0 flex-col gap-1.5">
          <span aria-hidden className="text-label-sm text-muted-foreground">
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

// The loop's length from its first bar: 1 · 2 · 4 · 8 bars, ÷2 and ×2. The one it has is marked.
function Length({ loop }: { loop: LoopRange }) {
  const practice = usePractice()
  const { grid } = practice
  const titleId = useId()
  if (!grid) return null
  const length = lengthOf(loop)
  const halve = moveLoop(grid, loop, 'half')
  const double = moveLoop(grid, loop, 'double')
  return (
    <fieldset aria-labelledby={titleId} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <span id={titleId} className="text-label-sm text-muted-foreground">
        {m['practice.loop_length']()}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {LENGTHS.map((bars) => {
          const end = Math.min(grid.lastBar, loop.startBar + bars - 1)
          const fits = end - loop.startBar + 1 === bars
          return (
            <Button
              key={bars}
              variant={length === bars ? 'selected' : 'quiet'}
              size="icon-practice"
              aria-pressed={length === bars}
              aria-label={m['practice.loop_length_named']({ bars: String(bars) })}
              disabled={!fits}
              className="tabular-nums"
              onClick={() => practice.setLoop(barRange(grid, loop.startBar, end), 'numeric')}
            >
              {bars}
            </Button>
          )
        })}
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="quiet"
          size="icon-practice"
          disabled={halve === loop}
          onClick={() => practice.setLoop(halve, 'numeric')}
        >
          <span aria-hidden>÷2</span>
          <span className="sr-only">{m['practice.loop_half']()}</span>
        </Button>
        <Button
          variant="quiet"
          size="icon-practice"
          disabled={double === loop}
          onClick={() => practice.setLoop(double, 'numeric')}
        >
          <span aria-hidden>×2</span>
          <span className="sr-only">{m['practice.loop_double']()}</span>
        </Button>
      </div>
    </fieldset>
  )
}

/** The loop moved back (−1) or on (1) by its own length, inside the song (Shift ← / →). */
function shiftedLoop(
  grid: NonNullable<ReturnType<typeof usePractice>['grid']>,
  loop: LoopRange,
  direction: 1 | -1,
): LoopRange {
  const length = lengthOf(loop)
  const start = Math.min(
    Math.max(grid.firstBar, loop.startBar + direction * length),
    Math.max(grid.firstBar, grid.lastBar - length + 1),
  )
  if (start === loop.startBar) return loop
  return barRange(grid, start, Math.min(grid.lastBar, start + length - 1))
}

// Move the loop by its own length: the same as Shift ← / Shift →, with the keys on the buttons.
function Move({ loop }: { loop: LoopRange }) {
  const practice = usePractice()
  const { grid } = practice
  const titleId = useId()
  if (!grid) return null
  const back = shiftedLoop(grid, loop, -1)
  const on = shiftedLoop(grid, loop, 1)
  return (
    <fieldset aria-labelledby={titleId} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <span id={titleId} className="text-label-sm text-muted-foreground">
        {m['practice.loop_move']()}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="practice"
          shortcut={keyLabel('Shift+ArrowLeft')}
          disabled={back === loop}
          onClick={() => practice.setLoop(back, 'numeric')}
        >
          <ChevronLeftIcon aria-hidden />
          {m['practice.loop_move_back']()}
        </Button>
        <Button
          variant="outline"
          size="practice"
          shortcut={keyLabel('Shift+ArrowRight')}
          disabled={on === loop}
          onClick={() => practice.setLoop(on, 'numeric')}
        >
          {m['practice.next_phrase']()}
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </fieldset>
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
    <details className="group/fine flex flex-col">
      <summary className="flex min-h-target-practice cursor-pointer list-none items-center gap-2 rounded-field text-label-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden
          className="size-4 transition-transform duration-(--duration-fast) group-open/fine:rotate-90"
        />
        {m['practice.fine_tune']()}
      </summary>
      <div className="flex flex-col pl-6">
        {edges.map(({ edge, name }) => (
          <div key={edge} className="flex min-h-target-practice items-center gap-1">
            <span className="min-w-0 flex-1 text-body-sm">{name}</span>
            <Button
              size="icon-practice"
              variant="quiet"
              aria-label={m['practice.nudge_earlier']({ edge: name })}
              onClick={() => practice.setLoop(nudge(grid, loop, edge, -1))}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              size="icon-practice"
              variant="quiet"
              aria-label={m['practice.nudge_later']({ edge: name })}
              onClick={() => practice.setLoop(nudge(grid, loop, edge, 1))}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        ))}
        <p className="text-body-sm text-muted-foreground">{m['practice.nudge_hint']()}</p>
      </div>
    </details>
  )
}

function BetweenRepeats({ loop }: { loop: LoopRange }) {
  const practice = usePractice()
  const { player, grid, send, layers } = practice
  const passPrompt = usePracticeDefaults((s) => s.passPrompt)
  const update = usePracticeDefaults((s) => s.update)
  const rests: Record<RestBetween, string> = {
    none: m['settings.rest_none'](),
    beat: m['settings.rest_beat'](),
    bar: m['settings.rest_bar'](),
  }
  return (
    <PanelSection
      title={m['practice.loop_section_repeats']()}
      aria-label={m['practice.loop_section_repeats']()}
    >
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
        shortcut={layers.beats ? keyLabel('i') : undefined}
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
      <SwitchRow
        label={m['practice.ask_after_pass']()}
        hint={
          <>
            <Kbd>{keyLabel('c')}</Kbd> <Kbd>{keyLabel('n')}</Kbd>{' '}
            {m['practice.ask_after_pass_hint']()}
          </>
        }
        checked={passPrompt}
        onCheckedChange={(on) => {
          update({ passPrompt: on })
          send({ type: 'SET_ASSESS', on })
        }}
      />
    </PanelSection>
  )
}

// Saved clips (27 §3.7.4): "Save this loop" names the loop being played; each named clip is a
// hairline row (name, "bars 25–28 · best 80 %") that loops it as it was left, the one playing
// marked by the ink edge, with Rename and Delete in its ⋯ menu.
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
    <PanelSection
      title={m['practice.clips']()}
      action={
        unsaved &&
        !naming && (
          <Button variant="quiet" size="sm" onClick={() => setNaming(true)}>
            {m['practice.save_this_loop']()}
          </Button>
        )
      }
    >
      {unsaved && naming && (
        <form
          className="flex items-end gap-2"
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
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={id}>{m['practice.clip_name']()}</Label>
            <Input
              id={id}
              autoFocus
              required
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            {m['practice.save_clip']()}
          </Button>
        </form>
      )}
      {named.length > 0 && (
        <ul className="m-0 flex list-none flex-col border-t border-border p-0">
          {named.map((c) =>
            renaming === c.id ? (
              <li key={c.id} className="border-b border-border">
                <RenameClip
                  clip={c}
                  onDone={(next) => {
                    setRenaming(null)
                    if (next) renameClip(queryClient, c, next)
                  }}
                />
              </li>
            ) : (
              <ClipRow
                key={c.id}
                clip={c}
                active={c.id === clip?.id}
                onRename={() => setRenaming(c.id)}
                onDelete={() => deleteClip(queryClient, c)}
              />
            ),
          )}
        </ul>
      )}
    </PanelSection>
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
    <ListRow
      current={active}
      className="min-h-target-practice px-0 pl-2"
      title={clip.name}
      meta={
        clip.best_clean_tempo_pct === null
          ? m['practice.clip_bars']({ bars })
          : m['practice.clip_bars_best']({ bars, pct: String(clip.best_clean_tempo_pct) })
      }
      render={
        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          className="text-left"
          onClick={() => practice.selectClip(clip, 'clip')}
        />
      }
      aside={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="quiet"
                size="icon-practice"
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
      }
    />
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
      className="flex min-w-0 flex-wrap items-center gap-2 py-2"
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
        className="min-w-0 flex-1 basis-40"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="outline" size="sm">
        {m['practice.clip_rename_save']()}
      </Button>
      <Button type="button" variant="quiet" size="sm" onClick={() => onDone(null)}>
        {m['common.cancel']()}
      </Button>
    </form>
  )
}
