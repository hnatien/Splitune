import { useId, useRef } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { Popover } from '@/ui/popover'
import { PopoverContent } from '@/ui/popover-content'
import { LadderChip, LadderIcon, SpeedLadder } from '@/ui/speed-ladder'
import { Switch } from '@/ui/switch'
import { OptionSegments } from '../common/option-segments'
import {
  defaultLadder,
  LADDER_MAX_PCT,
  LADDER_MIN_PCT,
  type LadderSettings,
  type LadderView,
  withSetting,
} from './model/ladder'
import { usePractice } from './practice-context'

// The Speed ladder card of the Loop tab (27 §3.7.4, Main.dc.html; 12 §5): the switch, the rungs
// from start to goal, what the next clean pass does, and a chip per setting that opens its
// stepper (Start, Goal, Step, clean passes; More: back down after misses, count-in before each
// pass, at the goal). Every number is the learner's to change: the ladder is a default, not a
// method. It loads with the Loop tab, outside the practice route's budget.

const list = new Intl.ListFormat('en', { type: 'conjunction' })

/** The ladder in words: "70 percent done, 75 percent now, 80 percent next". */
export function ladderLabel(view: LadderView): string {
  const done = view.rungs.slice(0, view.current).map(String)
  const current = String(view.rungs[view.current] ?? '')
  const doneText =
    done.length > 3
      ? m['ladder.aria_span']({ from: done[0] ?? '', to: done.at(-1) ?? '' })
      : list.format(done)
  const next = view.rungs[view.current + 1]
  if (next === undefined) {
    return done.length > 0
      ? m['ladder.aria_goal']({ done: doneText, current })
      : m['ladder.aria_goal_only']({ current })
  }
  return done.length > 0
    ? m['ladder.aria']({ done: doneText, current, next: String(next) })
    : m['ladder.aria_start']({ current, next: String(next) })
}

/** "Up 5 % after 3 clean passes. Clean pass 3 of 3 at 75 % moves you to 80 %." */
function summary(settings: LadderSettings, view: LadderView, speedPct: number): string {
  const step = formatPercent(settings.step_pct)
  const rule =
    settings.plays_per_step === 1
      ? m['ladder.summary_one']({ step })
      : m['ladder.summary']({ step, passes: String(settings.plays_per_step) })
  const pass = { pass: String(view.pass), of: String(view.of), speed: formatPercent(speedPct) }
  const last = view.pass >= view.of
  if (view.nextPct !== null) {
    const next = formatPercent(view.nextPct)
    return `${rule} ${last ? m['ladder.next_up_last']({ ...pass, next }) : m['ladder.next_up']({ ...pass, next })}`
  }
  if (settings.on_goal === 'keep') return `${rule} ${m['ladder.goal_keep']({ speed: pass.speed })}`
  return `${rule} ${last ? m['ladder.goal_stop_last'](pass) : m['ladder.goal_stop'](pass)}`
}

// A chip and the stepper it opens. The popover sits outside the practice shell, so it asks for the
// practice density itself: the stepper's halves are 48 px there (26 §8).
function StepperChip({
  chip,
  label,
  value,
  min,
  max,
  step,
  unit,
  fewer,
  more,
  onChange,
}: {
  chip: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  fewer: string
  more: string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <Popover>
      <LadderChip>{chip}</LadderChip>
      <PopoverContent
        data-density="practice"
        aria-label={label}
        align="start"
        className="w-auto gap-2"
      >
        <Label htmlFor={id}>{label}</Label>
        <NumberField
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          {...(unit ? { unit } : {})}
          decrementLabel={fewer}
          incrementLabel={more}
          onValueChange={(next) => next !== null && onChange(Math.round(next))}
        />
      </PopoverContent>
    </Popover>
  )
}

function MoreChip({
  settings,
  onChange,
}: {
  settings: LadderSettings
  onChange: (patch: Partial<LadderSettings>) => void
}) {
  const missesId = useId()
  const countInId = useId()
  const misses = settings.drop_after_misses
  return (
    <Popover>
      <LadderChip>{m['ladder.chip_more']()}</LadderChip>
      <PopoverContent
        data-density="practice"
        aria-label={m['ladder.chip_more']()}
        align="end"
        className="w-72 gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={missesId}>{m['ladder.back_down']()}</Label>
          <NumberField
            id={missesId}
            value={misses}
            min={0}
            max={5}
            step={1}
            decrementLabel={m['ladder.fewer_misses']()}
            incrementLabel={m['ladder.more_misses']()}
            onValueChange={(next) =>
              next !== null && onChange({ drop_after_misses: Math.round(next) })
            }
          />
          <p className="text-sm text-muted-foreground">
            {misses === 0
              ? m['ladder.back_down_off']()
              : misses === 1
                ? m['ladder.back_down_hint_one']()
                : m['ladder.back_down_hint']({ misses: String(misses) })}
          </p>
        </div>
        <div className="flex min-h-target-practice-2 items-center gap-3">
          <Switch
            id={countInId}
            checked={settings.count_in_each_pass}
            onCheckedChange={(on) => onChange({ count_in_each_pass: on })}
          />
          <Label htmlFor={countInId}>{m['ladder.count_in_each']()}</Label>
        </div>
        <OptionSegments
          label={m['ladder.on_goal']()}
          value={settings.on_goal}
          options={[
            { value: 'keep', label: m['ladder.on_goal_keep']() },
            { value: 'stop', label: m['ladder.on_goal_stop']() },
          ]}
          onChange={(on_goal) => onChange({ on_goal })}
        />
      </PopoverContent>
    </Popover>
  )
}

export function LadderCard() {
  const practice = usePractice()
  const { player, ladder: view, best } = practice
  const cleanPasses = usePracticeDefaults((s) => s.ladderCleanPasses)
  const titleId = useId()
  // Switching the ladder off and on again brings its settings back.
  const remembered = useRef<LadderSettings | null>(null)
  const settings = player.ladder?.settings
  const change = (patch: Partial<LadderSettings>) => {
    if (settings) practice.setLadder(withSetting(settings, patch))
  }
  return (
    <section
      aria-labelledby={titleId}
      data-slot="ladder-card"
      className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-3.5"
    >
      <div className="flex min-h-target-practice-2 items-center gap-2.5">
        <LadderIcon aria-hidden strokeWidth={1.8} className="size-5 text-primary-ink" />
        <h3 id={titleId} className="min-w-0 flex-1 text-lg">
          {m['ladder.title']()}
        </h3>
        <Switch
          aria-labelledby={titleId}
          checked={settings !== undefined}
          onCheckedChange={(on) => {
            if (on) {
              practice.setLadder(
                remembered.current ?? defaultLadder(best, cleanPasses, player.speedPct),
              )
            } else {
              remembered.current = settings ?? null
              practice.setLadder(null)
            }
          }}
        />
      </div>
      {settings && view ? (
        <>
          <SpeedLadder rungs={view.rungs} current={view.current} label={ladderLabel(view)} />
          <p className="text-sm text-muted-foreground tabular-nums">
            {summary(settings, view, view.speedPct)}
          </p>
          <div className="-my-2 flex flex-wrap gap-x-1.5">
            <StepperChip
              chip={m['ladder.chip_start']({ speed: formatPercent(settings.start_pct) })}
              label={m['ladder.start']()}
              value={settings.start_pct}
              min={LADDER_MIN_PCT}
              max={LADDER_MAX_PCT}
              step={5}
              unit="%"
              fewer={m['ladder.start_lower']()}
              more={m['ladder.start_raise']()}
              onChange={(start_pct) => change({ start_pct })}
            />
            <StepperChip
              chip={m['ladder.chip_goal']({ speed: formatPercent(settings.end_pct) })}
              label={m['ladder.goal']()}
              value={settings.end_pct}
              min={LADDER_MIN_PCT}
              max={LADDER_MAX_PCT}
              step={5}
              unit="%"
              fewer={m['ladder.goal_lower']()}
              more={m['ladder.goal_raise']()}
              onChange={(end_pct) => change({ end_pct })}
            />
            <StepperChip
              chip={m['ladder.chip_step']({ step: formatPercent(settings.step_pct) })}
              label={m['ladder.step']()}
              value={settings.step_pct}
              min={1}
              max={50}
              step={1}
              unit="%"
              fewer={m['ladder.step_smaller']()}
              more={m['ladder.step_bigger']()}
              onChange={(step_pct) => change({ step_pct })}
            />
            <StepperChip
              chip={
                settings.plays_per_step === 1
                  ? m['ladder.chip_passes_one']()
                  : m['ladder.chip_passes']({ passes: String(settings.plays_per_step) })
              }
              label={m['ladder.passes']()}
              value={settings.plays_per_step}
              min={1}
              max={20}
              step={1}
              fewer={m['ladder.fewer_passes']()}
              more={m['ladder.more_passes']()}
              onChange={(plays_per_step) => change({ plays_per_step })}
            />
            <MoreChip settings={settings} onChange={change} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{m['ladder.off_hint']()}</p>
      )}
    </section>
  )
}
