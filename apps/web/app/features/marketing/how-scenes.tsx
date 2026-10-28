import {
  CheckIcon,
  DrumIcon,
  FileAudioIcon,
  GuitarIcon,
  LinkIcon,
  type LucideIcon,
  MicIcon,
  UploadIcon,
} from 'lucide-react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChordChip } from '@/ui/chord-chip'
import { LoopBadge } from '@/ui/loop-badge'
import { PassControl } from '@/ui/pass-control'
import { Progress, ProgressLabel, ProgressValue } from '@/ui/progress'
import { SpeedControl } from '@/ui/speed-control'
import { Still, TabStill } from './product-still'

// How it works (27 §3.2): one picture of the app per step, drawn at `t` (0–1), how far the reader
// has scrolled through that step. The scroll is the clock, so nothing moves on its own and nothing
// loops (26 §10); under reduced motion the page passes t = 1 and each step shows its last frame.
// The same 8-bar Am–F–C–G riff as Home's stills, followed from upload to a clean pass.

const noop = () => undefined

/** Share of `from`–`to` that `t` has covered, eased out; 0 before and 1 after. */
export function ramp(t: number, from: number, to: number, eased = true): number {
  const x = Math.min(1, Math.max(0, (t - from) / (to - from)))
  return eased ? 1 - (1 - x) ** 3 : x
}

const lerp = (a: number, b: number, x: number) => a + (b - a) * x

// Peaks for a positional waveform, 0–1. Deterministic so stories and visual tests never change.
type Shape = (i: number) => number
const SHAPES = {
  mix: (i) =>
    0.35 + 0.45 * Math.abs(Math.sin(i * 0.23) * Math.cos(i * 0.051)) + ((i * 37) % 7) / 40,
  guitar: (i) => 0.25 + 0.6 * (1 - (i % 4) / 4) ** 2,
  bass: (i) => 0.2 + 0.55 * (1 - (i % 8) / 8),
  drums: (i) => (i % 4 === 0 ? 0.95 : i % 2 === 0 ? 0.45 : 0.12),
  vocals: (i) => (i % 32 < 22 ? 0.25 + 0.5 * Math.abs(Math.sin(i * 0.31)) : 0.05),
} satisfies Record<string, Shape>

function Peaks({
  bins,
  x,
  width,
  y,
  amplitude,
  shape,
  reveal = 1,
  className,
}: {
  bins: number
  x: number
  width: number
  y: number
  amplitude: number
  shape: Shape
  reveal?: number
  className: string
}) {
  const step = width / bins
  return (
    <g className={className}>
      {Array.from({ length: Math.ceil(bins * reveal) }, (_, i) => {
        const h = Math.max(2, shape(i) * amplitude * 2)
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional and never reorder
            key={i}
            x={x + i * step + step * 0.2}
            y={y - h / 2}
            width={step * 0.6}
            height={h}
            rx={Math.min(1.5, step * 0.3)}
          />
        )
      })}
    </g>
  )
}

/** Step 1: the file drops in, uploads, and its waveform is read. */
function ImportScene({ t }: { t: number }) {
  const drop = ramp(t, 0, 0.25)
  const upload = ramp(t, 0.25, 0.55, false)
  const decode = ramp(t, 0.55, 0.85, false)
  const sources: { icon: LucideIcon; label: string; chosen: boolean }[] = [
    { icon: UploadIcon, label: m['how.scene_upload'](), chosen: true },
    { icon: MicIcon, label: m['how.scene_record'](), chosen: false },
    { icon: LinkIcon, label: m['how.scene_link'](), chosen: false },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {sources.map(({ icon: Icon, label, chosen }) => (
          <span
            key={label}
            className={cn(
              'flex min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-medium',
              chosen
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border text-muted-foreground',
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>
      <div
        className={cn(
          'flex flex-col gap-4 rounded-xl border-2 border-dashed p-4 transition-colors',
          upload > 0 ? 'border-primary bg-surface-sunken' : 'border-input',
        )}
      >
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 shadow-2"
          style={{ opacity: drop, transform: `translateY(${(1 - drop) * -40}px)` }}
        >
          <FileAudioIcon aria-hidden className="size-8 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{m['how.scene_file']()}</span>
            <span className="text-sm text-muted-foreground">{m['how.scene_file_meta']()}</span>
          </span>
        </div>
        <Progress value={Math.round(upload * 100)} className="justify-between">
          <ProgressLabel>
            {upload < 1 ? m['how.scene_uploading']() : m['how.scene_uploaded']()}
          </ProgressLabel>
          <ProgressValue className="text-sm text-muted-foreground tabular-nums" />
        </Progress>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <svg aria-hidden viewBox="0 0 480 64" className="block h-14 w-full">
          <line x1={0} x2={480} y1={32} y2={32} strokeWidth={1} className="stroke-border" />
          <Peaks
            bins={96}
            x={0}
            width={480}
            y={32}
            amplitude={28}
            shape={SHAPES.mix}
            reveal={decode}
            className="fill-waveform-peak"
          />
        </svg>
        <span
          className={cn(
            'flex items-center gap-2 text-sm font-medium',
            decode < 1 && 'text-muted-foreground',
          )}
        >
          {decode >= 1 && <CheckIcon aria-hidden className="size-4 text-success" />}
          {decode >= 1 ? m['how.scene_ready']() : m['how.scene_decoding']()}
        </span>
      </div>
    </div>
  )
}

const LANES = [
  { stem: 'guitar', icon: GuitarIcon, name: () => m['instrument.guitar'](), y: 38 },
  { stem: 'bass', icon: GuitarIcon, name: () => m['instrument.bass'](), y: 106 },
  { stem: 'drums', icon: DrumIcon, name: () => m['instrument.drums'](), y: 174 },
  { stem: 'vocals', icon: MicIcon, name: () => m['instrument.vocals'](), y: 242 },
] as const
const STEM_FILL = {
  guitar: 'fill-stem-guitar',
  bass: 'fill-stem-bass',
  drums: 'fill-stem-drums',
  vocals: 'fill-stem-vocals',
} as const
const WAVE_X = 132
const WAVE_W = 420

/** Step 2: the full mix pulls apart into four stems, then guitar is picked as your part. */
function SeparateScene({ t }: { t: number }) {
  const split = ramp(t, 0.1, 0.55)
  const labels = ramp(t, 0.4, 0.6)
  const pick = ramp(t, 0.65, 0.85)
  return (
    <svg aria-hidden viewBox="0 0 560 280" className="block w-full">
      <g opacity={1 - split}>
        <text x={0} y={146} className="fill-muted-foreground text-[18px] font-semibold">
          {m['how.scene_mix']()}
        </text>
        <Peaks
          bins={64}
          x={WAVE_X}
          width={WAVE_W}
          y={140}
          amplitude={lerp(56, 26, split)}
          shape={SHAPES.mix}
          className="fill-stem-mix"
        />
      </g>
      {LANES.map(({ stem, icon: Icon, name, y }) => {
        const yours = stem === 'guitar'
        const laneY = lerp(140, y, split)
        return (
          <g key={stem} opacity={yours ? 1 : lerp(1, 0.4, pick)}>
            <g opacity={split}>
              <Peaks
                bins={64}
                x={WAVE_X}
                width={WAVE_W}
                y={laneY}
                amplitude={lerp(40, 26, split)}
                shape={SHAPES[stem]}
                className={STEM_FILL[stem]}
              />
            </g>
            <g opacity={labels}>
              <rect x={0} y={y - 26} width={4} height={52} rx={2} className={STEM_FILL[stem]} />
              <Icon x={14} y={y - 24} width={20} height={20} className="text-foreground" />
              <text x={40} y={y - 8} className="fill-foreground text-[18px] font-semibold">
                {name()}
              </text>
            </g>
            {yours && (
              <g opacity={pick}>
                <rect x={12} y={y + 2} width={104} height={26} rx={13} className="fill-accent" />
                <text
                  x={64}
                  y={y + 15}
                  dy="0.35em"
                  textAnchor="middle"
                  className="fill-accent-foreground text-[15px] font-semibold"
                >
                  {m['home.still_your_part']()}
                </text>
                <rect
                  x={WAVE_X - 6}
                  y={y - 32}
                  width={WAVE_W + 10}
                  height={64}
                  rx={10}
                  strokeWidth={2}
                  className="fill-none stroke-primary"
                />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Bars 5–8 of the riff, matching TabStill cropped to them: 8 px in, 150 px a bar.
const CHART = { width: 610, bar: 150, left: 8 } as const
const CHORDS = [
  { label: 'Am', confidence: 'high' },
  { label: 'F', confidence: 'high' },
  { label: 'C', confidence: 'high' },
  { label: 'G', confidence: 'low' },
] as const

function RowLabel({ children }: { children: string }) {
  return <span className="text-sm font-semibold text-muted-foreground">{children}</span>
}

/** Step 3: beats tick in on your part, bar lines follow, then the chords and the tab. */
function TranscribeScene({ t }: { t: number }) {
  const beats = ramp(t, 0, 0.25, false)
  const bars = ramp(t, 0.15, 0.35)
  const tab = ramp(t, 0.55, 0.92, false)
  const barX = (bar: number) => CHART.left + bar * CHART.bar
  return (
    <div className="flex flex-col gap-3">
      <RowLabel>{m['how.scene_beat']()}</RowLabel>
      <svg aria-hidden viewBox={`0 0 ${CHART.width} 76`} className="block w-full">
        <Peaks
          bins={48}
          x={CHART.left}
          width={CHART.bar * 4}
          y={44}
          amplitude={20}
          shape={SHAPES.guitar}
          className="fill-stem-guitar"
        />
        {Array.from({ length: 16 }, (_, beat) => {
          const x = barX(beat / 4)
          if (beat / 16 >= beats) return null
          return (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: beats are positional and never reorder
              key={beat}
              x1={x}
              x2={x}
              y1={beat % 4 === 0 ? 18 : 64}
              y2={72}
              strokeWidth={beat % 4 === 0 ? 2 : 1.5}
              opacity={beat % 4 === 0 ? bars : 1}
              className={beat % 4 === 0 ? 'stroke-foreground' : 'stroke-muted-foreground'}
            />
          )
        })}
        <g opacity={bars} className="fill-muted-foreground text-[12px] font-semibold tabular-nums">
          {[5, 6, 7, 8].map((bar, i) => (
            <text key={bar} x={barX(i) + 6} y={14}>
              {bar}
            </text>
          ))}
        </g>
      </svg>
      <RowLabel>{m['how.scene_chords']()}</RowLabel>
      <div className="relative h-12 rounded-lg bg-paper text-ink">
        {CHORDS.map((chord, i) => {
          const pop = ramp(t, 0.3 + i * 0.06, 0.42 + i * 0.06)
          return (
            <ChordChip
              key={chord.label}
              label={chord.label}
              confidence={chord.confidence}
              showUncertainty
              className="absolute top-1/2"
              style={{
                left: `${((barX(i) + 6) / CHART.width) * 100}%`,
                opacity: pop,
                transform: `translateY(-50%) scale(${lerp(0.8, 1, pop)})`,
              }}
            />
          )
        })}
      </div>
      <RowLabel>{m['how.scene_tab']()}</RowLabel>
      <TabStill bars={{ from: 5, to: 8 }} reveal={tab} loop={0} playhead={null} />
    </div>
  )
}

/** Step 4: drag a loop over bars 5–8, play it, slow it to 70 %, play it again and mark it clean. */
function PractiseScene({ t }: { t: number }) {
  const loop = ramp(t, 0, 0.18)
  const first = ramp(t, 0.18, 0.4, false)
  const slow = ramp(t, 0.42, 0.52)
  const second = ramp(t, 0.52, 0.85, false)
  const clean = t >= 0.88
  const playhead = loop < 1 ? null : 5 + 4 * (second > 0 ? second : first)
  const pass = 1 + (first >= 1 ? 1 : 0) + (second >= 1 ? 1 : 0)
  const speed = Math.round(lerp(100, 70, slow) / 5) * 5
  return (
    <div className="flex flex-col gap-4">
      <TabStill bars={{ from: 4, to: 8 }} loop={loop} playhead={playhead} />
      <div className="flex flex-wrap items-center gap-3">
        <LoopBadge state={loop < 1 ? 'armed' : 'active'}>
          {m['how.scene_loop']({ pass: String(pass) })}
        </LoopBadge>
        <SpeedControl
          value={speed}
          bpm={100}
          onValueChange={noop}
          labels={{
            speed: m['home.still_speed'](),
            decrease: m['home.still_speed'](),
            increase: m['home.still_speed'](),
            presets: m['home.still_speed'](),
          }}
        />
      </div>
      <PassControl
        labels={{
          prompt: m['practice.pass_prompt'](),
          clean: m['practice.felt_clean'](),
          notYet: m['practice.not_yet'](),
        }}
        best={clean ? m['practice.best_tempo']({ pct: String(speed) }) : undefined}
        onClean={noop}
        onNotYet={noop}
      />
    </div>
  )
}

const SCENES = [
  { title: () => m['how.scene_1_title'](), Scene: ImportScene },
  { title: () => m['how.scene_2_title'](), Scene: SeparateScene },
  { title: () => m['how.scene_3_title'](), Scene: TranscribeScene },
  { title: () => m['how.scene_4_title'](), Scene: PractiseScene },
] as const

/**
 * The app window showing step `step` at `t`. Every scene is laid out in the same cell, so the
 * window keeps the tallest one's height and switching steps cross-fades without a jump; steps
 * already passed sit at their last frame, steps to come at their first. `only` draws just this
 * step's scene, for a window that never switches.
 */
export function HowStage({
  step,
  t,
  only = false,
  className,
}: {
  step: number
  t: number
  only?: boolean
  className?: string
}) {
  return (
    <Still className={cn('rounded-3xl border border-border bg-card shadow-3', className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2 text-sm font-medium text-muted-foreground">
          {SCENES[step]?.title()}
        </span>
      </div>
      <div className="grid p-4 md:p-6">
        {SCENES.map(({ title, Scene }, i) =>
          only && i !== step ? null : (
            <div
              key={title()}
              data-active={i === step}
              className="col-start-1 row-start-1 self-center opacity-0 transition-opacity duration-slow ease-standard data-[active=true]:opacity-100"
            >
              <Scene t={i < step ? 1 : i > step ? 0 : t} />
            </div>
          ),
        )}
      </div>
    </Still>
  )
}
