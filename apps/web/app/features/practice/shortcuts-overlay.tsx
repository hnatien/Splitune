import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import { PedalIcon } from '@/ui/icons'
import { Kbd, KbdGroup } from '@/ui/kbd'
import { actionLabel, keyLabel } from './input-mapper'
import { useKeys } from './keys-store'
import { type Action, keysFor, LOOP_BARS, SPEED_KEYS } from './model/keymap'
import { usePracticeUi } from './practice-store'

// The `?` shortcuts overlay (27 §3.7.4, s47 direction §7), on every layout: every practice key,
// grouped by what it is for, each row the action in words and its keys as caps (learned pedal
// keys first), so the list reads as a reference and not as a wall of buttons. Learning a pedal is
// in Settings → Keyboard & pedal, one link at the foot. Then the keys that work everywhere: the
// command palette (with single keys off too), this list and undo.

type Row = { label: string; keys: string[] }

const GROUPS: { title: () => string; actions: Action[] }[] = [
  {
    title: () => m['shortcuts.group_play'](),
    actions: ['playPause', 'restart', 'next', 'fromTop', 'pedalLeft', 'pedalRight'],
  },
  {
    title: () => m['shortcuts.group_loop'](),
    actions: ['toggleLoop', 'loopBack', 'loopForward', 'countIn', 'click'],
  },
  { title: () => m['shortcuts.group_speed'](), actions: ['slower', 'faster', 'speed'] },
  { title: () => m['shortcuts.group_pass'](), actions: ['clean', 'notYet'] },
  { title: () => m['shortcuts.group_view'](), actions: ['tools', 'view', 'marks', 'mutePart'] },
  {
    title: () => m['shortcuts.group_fix'](),
    actions: ['nextUnsure', 'previousUnsure', 'fixBar', 'acceptFix'],
  },
  {
    title: () => m['shortcuts.group_vocals'](),
    actions: ['previousPhrase', 'nextPhrase', 'cueNote'],
  },
]

export function ShortcutsOverlay() {
  const open = usePracticeUi((s) => s.shortcutsOpen)
  const learned = useKeys((s) => s.learned)
  const rows = (actions: Action[]): Row[] =>
    actions.map((action) => ({
      label: actionLabel(action),
      keys: keysFor(action, learned).map(keyLabel),
    }))
  const sections: { title: string; rows: Row[] }[] = GROUPS.map((group) => ({
    title: group.title(),
    rows: rows(group.actions),
  }))
  // The digit keys are fixed: loops of 1, 2, 4 and 8 bars, and the speeds with Shift.
  sections[1]?.rows.push({
    label: m['shortcuts.loop_bars'](),
    keys: LOOP_BARS.map(String),
  })
  sections[2]?.rows.push({
    label: m['shortcuts.speed_keys'](),
    keys: Object.keys(SPEED_KEYS).map(keyLabel),
  })
  sections.push({
    title: m['shortcuts.group_app'](),
    rows: [
      {
        label: m['shortcuts.palette'](),
        keys: [m['nav.palette_key_mac'](), m['nav.palette_key']()],
      },
      { label: m['shortcuts.this_list'](), keys: ['?'] },
      {
        label: m['shortcuts.undo'](),
        keys: [m['shortcuts.key_undo_mac'](), m['shortcuts.key_undo']()],
      },
    ],
  })
  return (
    <Dialog open={open} onOpenChange={(next) => usePracticeUi.setState({ shortcutsOpen: next })}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m['practice.shortcuts']()}</DialogTitle>
          <DialogDescription>{m['shortcuts.description']()}</DialogDescription>
        </DialogHeader>
        <div data-slot="shortcut-groups" className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col">
              <h3 className="border-b border-border pb-1.5 text-label-sm text-muted-foreground">
                {section.title}
              </h3>
              <dl className="m-0 flex flex-col">
                {section.rows.map((row) => (
                  <div
                    key={row.label}
                    data-slot="shortcut-row"
                    className="flex min-h-10 items-center justify-between gap-4 border-b border-border py-1.5"
                  >
                    <dt className="text-body-sm text-foreground">{row.label}</dt>
                    <dd className="m-0 shrink-0">
                      <KbdGroup>
                        {row.keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </KbdGroup>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <Link
          to="/settings/keyboard"
          className={buttonVariants({ variant: 'outline', className: 'self-start' })}
          onClick={() => usePracticeUi.setState({ shortcutsOpen: false })}
        >
          <PedalIcon aria-hidden />
          {m['shortcuts.set_up_pedal']()}
        </Link>
      </DialogContent>
    </Dialog>
  )
}
