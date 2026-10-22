import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { client, orpc } from '@/lib/api'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { Switch } from '@/ui/switch'
import { OptionSelect } from '../common/option-select'
import { barRange, nudge, restSeconds } from './model/loops'
import type { RestBetween } from './model/player-machine'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The loop's options behind the status bar's loop badge (12 §5): bars by number (the third way to
// set a loop), nudge either edge by a sixteenth, rest between repeats, count-in bars, the pass
// prompt, and saving it as a named clip.

export function LoopPanel() {
  const practice = usePractice()
  const { player, grid, clips, clip, send } = practice
  const loop = player.loop
  return (
    <PopoverContent align="end" className="w-[22rem] gap-4">
      <PopoverTitle>{m['practice.loop_options']()}</PopoverTitle>
      {grid ? (
        <LoopFields />
      ) : (
        <p className="text-sm text-muted-foreground">{m['practice.loop_needs_beats']()}</p>
      )}
      {loop && grid && (
        <>
          <RestAndCountIn />
          <SaveClip />
          <Button
            variant="ghost"
            onClick={() => {
              practice.setLoop(null)
              usePracticeUi.setState({ selection: { kind: 'none' } })
              send({ type: 'SET_LOOP_ON', on: false })
            }}
          >
            <XIcon aria-hidden />
            {m['practice.clear_loop']()}
          </Button>
        </>
      )}
      {clips.some((c) => c.name !== null) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{m['practice.clips']()}</p>
          <ul className="flex flex-col gap-1">
            {clips
              .filter((c) => c.name !== null)
              .map((c) => (
                <li key={c.id}>
                  <Button
                    variant={c.id === clip?.id ? 'secondary' : 'ghost'}
                    className="w-full justify-between"
                    onClick={() =>
                      practice.setLoop(
                        {
                          startBar: c.start_bar,
                          endBar: c.end_bar,
                          start: c.start_s,
                          end: c.end_s,
                        },
                        'clip',
                      )
                    }
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {m['practice.bars_range']({ bars: `${c.start_bar + 1}–${c.end_bar + 1}` })}
                    </span>
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </PopoverContent>
  )
}

function LoopFields() {
  const practice = usePractice()
  const { grid, player } = practice
  const loop = player.loop
  if (!grid) return null
  const first = grid.firstBar + 1
  const last = grid.lastBar + 1
  const setBars = (from: number, to: number) =>
    practice.setLoop(barRange(grid, from - 1, to - 1), 'numeric')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span aria-hidden className="text-sm font-medium">
            {m['practice.from_bar']()}
          </span>
          <NumberField
            value={loop ? loop.startBar + 1 : null}
            min={first}
            max={last}
            step={1}
            inputLabel={m['practice.from_bar']()}
            decrementLabel={m['practice.earlier']()}
            incrementLabel={m['practice.later']()}
            onValueChange={(value) =>
              value !== null && setBars(value, Math.max(value, (loop?.endBar ?? value - 1) + 1))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span aria-hidden className="text-sm font-medium">
            {m['practice.to_bar']()}
          </span>
          <NumberField
            value={loop ? loop.endBar + 1 : null}
            min={first}
            max={last}
            step={1}
            inputLabel={m['practice.to_bar']()}
            decrementLabel={m['practice.earlier']()}
            incrementLabel={m['practice.later']()}
            onValueChange={(value) =>
              value !== null && setBars(Math.min(value, (loop?.startBar ?? value - 1) + 1), value)
            }
          />
        </div>
      </div>
      {loop && (
        <div className="grid grid-cols-2 gap-2">
          {(['start', 'end'] as const).map((edge) => (
            <div key={edge} className="flex items-center gap-1">
              <span className="flex-1 text-sm">
                {edge === 'start' ? m['practice.nudge_start']() : m['practice.nudge_end']()}
              </span>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={m['practice.nudge_earlier']({
                  edge: edge === 'start' ? m['practice.nudge_start']() : m['practice.nudge_end'](),
                })}
                onClick={() => practice.setLoop(nudge(grid, loop, edge, -1))}
              >
                <ChevronLeftIcon aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={m['practice.nudge_later']({
                  edge: edge === 'start' ? m['practice.nudge_start']() : m['practice.nudge_end'](),
                })}
                onClick={() => practice.setLoop(nudge(grid, loop, edge, 1))}
              >
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RestAndCountIn() {
  const practice = usePractice()
  const { player, grid, send } = practice
  const passPrompt = usePracticeDefaults((s) => s.passPrompt)
  const update = usePracticeDefaults((s) => s.update)
  const promptId = useId()
  const loop = player.loop
  if (!loop) return null
  const rests: Record<RestBetween, string> = {
    none: m['settings.rest_none'](),
    beat: m['settings.rest_beat'](),
    bar: m['settings.rest_bar'](),
  }
  return (
    <div className="flex flex-col gap-3">
      <OptionSelect
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
      <OptionSelect
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
      <div className="flex items-center gap-3">
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
    </div>
  )
}

function SaveClip() {
  const practice = usePractice()
  const queryClient = useQueryClient()
  const [name, setName] = useState(practice.clip?.name ?? '')
  const id = useId()
  const clip = practice.clip
  if (!clip) return null
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        void client.loops
          .update({ id: practice.songId, loop_id: clip.id, name: trimmed })
          .then(() =>
            queryClient.invalidateQueries({
              queryKey: orpc.loops.list.queryKey({ input: { id: practice.songId } }),
            }),
          )
      }}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor={id}>{m['practice.clip_name']()}</Label>
        <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" variant="outline" disabled={name.trim() === ''}>
        {m['practice.save_clip']()}
      </Button>
    </form>
  )
}
