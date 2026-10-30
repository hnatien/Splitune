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

// How it works (27 §3.2): one picture of the app per step, following the same 8-bar Am–F–C–G riff
// as Home's stills from upload to a clean pass. The pictures are still (26 §10).

const noop = () => undefined

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
  className,
}: {
  bins: number
  x: number
  width: number
  y: number
  amplitude: number
  shape: Shape
  className: string
}) {
  const step = width / bins
  return (
    <g className={className}>
      {Array.from({ length: bins }, (_, i) => {
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
/** Step 1: the file is uploaded and its waveform read. */
function ImportScene() {
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
      <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-primary bg-surface-sunken p-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 shadow-2">
          <FileAudioIcon aria-hidden className="size-8 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{m['how.scene_file']()}</span>
            <span className="text-sm text-muted-foreground">{m['how.scene_file_meta']()}</span>
          </span>
        </div>
        <Progress value={100} className="justify-between">
          <ProgressLabel>{m['how.scene_uploaded']()}</ProgressLabel>
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
            className="fill-waveform-peak"
          />
        </svg>
        <span className="flex items-center gap-2 text-sm font-medium">
          <CheckIcon aria-hidden className="size-4 text-success" />
          {m['how.scene_ready']()}
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

/** Step 2: the mix split into four stems, with guitar picked as your part. */
function SeparateScene() {
  return (
    <svg aria-hidden viewBox="0 0 560 280" className="block w-full">
      {LANES.map(({ stem, icon: Icon, name, y }) => {
        const yours = stem === 'guitar'
        return (
          <g key={stem} opacity={yours ? 1 : 0.4}>
            <Peaks
              bins={64}
              x={WAVE_X}
              width={WAVE_W}
              y={y}
              amplitude={26}
              shape={SHAPES[stem]}
              className={STEM_FILL[stem]}
            />
            <rect x={0} y={y - 26} width={4} height={52} rx={2} className={STEM_FILL[stem]} />
            <Icon x={14} y={y - 24} width={20} height={20} className="text-foreground" />
            <text x={40} y={y - 8} className="fill-foreground text-[18px] font-semibold">
              {name()}
            </text>
            {yours && (
              <>
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
              </>
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

/** Step 3: beats and bar lines on your part, then the chords (the unsure G marked) and the tab. */
function TranscribeScene() {
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
        {Array.from({ length: 16 }, (_, beat) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: beats are positional and never reorder
            key={beat}
            x1={barX(beat / 4)}
            x2={barX(beat / 4)}
            y1={beat % 4 === 0 ? 18 : 64}
            y2={72}
            strokeWidth={beat % 4 === 0 ? 2 : 1.5}
            className={beat % 4 === 0 ? 'stroke-foreground' : 'stroke-muted-foreground'}
          />
        ))}
        <g className="fill-muted-foreground text-[12px] font-semibold tabular-nums">
          {[5, 6, 7, 8].map((bar, i) => (
            <text key={bar} x={barX(i) + 6} y={14}>
              {bar}
            </text>
          ))}
        </g>
      </svg>
      <RowLabel>{m['how.scene_chords']()}</RowLabel>
      <div className="relative h-12 rounded-lg bg-paper text-ink">
        {CHORDS.map((chord, i) => (
          <ChordChip
            key={chord.label}
            label={chord.label}
            confidence={chord.confidence}
            showUncertainty
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${((barX(i) + 6) / CHART.width) * 100}%` }}
          />
        ))}
      </div>
      <RowLabel>{m['how.scene_tab']()}</RowLabel>
      <TabStill bars={{ from: 5, to: 8 }} loop={false} playhead={null} />
    </div>
  )
}

/** Step 4: bars 5–8 looped and slowed to 70 %, on the third pass, marked clean. */
function PractiseScene() {
  const speed = 70
  return (
    <div className="flex flex-col gap-4">
      <TabStill bars={{ from: 4, to: 8 }} />
      <div className="flex flex-wrap items-center gap-3">
        <LoopBadge state="active">{m['how.scene_loop']({ pass: '3' })}</LoopBadge>
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
        best={m['practice.best_tempo']({ pct: String(speed) })}
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

/** The app window showing step `step` (0–3). */
export function HowStage({ step, className }: { step: number; className?: string }) {
  const scene = SCENES[step]
  if (!scene) return null
  const { title, Scene } = scene
  return (
    <Still className={cn('rounded-2xl border border-border bg-card shadow-3', className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2 text-sm font-medium text-muted-foreground">{title()}</span>
      </div>
      <div className="p-4 md:p-6">
        <Scene />
      </div>
    </Still>
  )
}
