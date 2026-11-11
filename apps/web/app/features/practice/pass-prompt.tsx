import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { PassControl } from '@/ui/pass-control'
import { usePractice } from './practice-context'

// The pass prompt (27 §3.7.1, Main.dc.html): "Pass 2 at 75 % — how was it?" floats 20 px above the
// dock with Felt clean (C) and Not yet (N) at 64 px; it leaves when answered or with the next
// pass's question, and never covers the focused control (it sits over the notation's foot).
export function PassPromptSheet({ pass }: { pass: number }) {
  const practice = usePractice()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-(--z-hud) flex justify-center px-4">
      <PassControl
        variant="prompt"
        className="pointer-events-auto"
        question={m['practice.pass_prompt']({
          pass: String(pass),
          speed: formatPercent(practice.player.speedPct),
        })}
        labels={{
          prompt: m['practice.pass_rate'](),
          clean: m['practice.felt_clean'](),
          notYet: m['practice.not_yet'](),
        }}
        shortcuts={{ clean: 'C', notYet: 'N' }}
        onClean={() => practice.markPass('clean')}
        onNotYet={() => practice.markPass('not_yet')}
      />
    </div>
  )
}
