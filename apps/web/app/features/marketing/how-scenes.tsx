import { FileAudioIcon, LinkIcon, MicIcon, UploadIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChordChip } from '@/ui/chord-chip'
import { Progress, ProgressLabel, ProgressValue } from '@/ui/progress'
import { Status } from '@/ui/status'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { ReadingTab, StillTransport } from './practice-still'
import { Still } from './product-still'

// How it works (27 §3.2): one picture of the app per step, following the same 8-bar Am–F–C–G riff
// as Home's practice picture from upload to a rated pass. Every word in a picture is HTML at its
// own type role, and the drawings (waveforms, beats) carry no text, so nothing shrinks below
// 11 px when a picture narrows to a phone; the tab shows fewer bars instead (ReadingTab). Each
// picture is one image with a text alternative that says what it shows. The pictures are still
// (26 §10).

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

/** A waveform as bars, stretched to its box; no text, so its width never matters. */
function Peaks({ bins, shape, className }: { bins: number; shape: Shape; className: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${bins} 40`}
      preserveAspectRatio="none"
      className={cn('block h-10 w-full', className)}
    >
      {Array.from({ length: bins }, (_, i) => {
        const h = Math.max(2, shape(i) * 36)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional and never reorder
          <rect key={i} x={i + 0.2} y={20 - h / 2} width={0.6} height={h} />
        )
      })}
    </svg>
  )
}

/** Step 1: the file is uploaded and its waveform read. */
function ImportScene() {
  return (
    <div className="flex flex-col gap-5">
      <Tabs value="upload">
        <TabsList look="pill">
          <TabsTrigger value="upload">
            <UploadIcon aria-hidden />
            {m['how.scene_upload']()}
          </TabsTrigger>
          <TabsTrigger value="record">
            <MicIcon aria-hidden />
            {m['how.scene_record']()}
          </TabsTrigger>
          <TabsTrigger value="link" className="max-sm:hidden">
            <LinkIcon aria-hidden />
            {m['how.scene_link']()}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-4 rounded-field bg-panel p-4">
        <div className="flex items-center gap-3">
          <FileAudioIcon aria-hidden className="size-8 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-label">{m['how.scene_file']()}</span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {m['how.scene_file_meta']()}
            </span>
          </span>
        </div>
        <Progress value={100} className="justify-between">
          <ProgressLabel>{m['how.scene_uploaded']()}</ProgressLabel>
          <ProgressValue className="text-body-sm text-muted-foreground tabular-nums" />
        </Progress>
      </div>
      <div className="flex flex-col gap-3">
        <Peaks bins={96} shape={SHAPES.mix} className="fill-waveform-peak" />
        <Status kind="ready">{m['how.scene_ready']()}</Status>
      </div>
    </div>
  )
}

const LANES = [
  { stem: 'guitar', name: () => m['instrument.guitar'](), rule: 'bg-stem-guitar' },
  { stem: 'bass', name: () => m['instrument.bass'](), rule: 'bg-stem-bass' },
  { stem: 'drums', name: () => m['instrument.drums'](), rule: 'bg-stem-drums' },
  { stem: 'vocals', name: () => m['instrument.vocals'](), rule: 'bg-stem-vocals' },
] as const

/**
 * Step 2: the mix split into four stems. Each stem's hue is a 4 px rule beside its name; the part
 * you picked has the ink edge, the words "Your part" and its waveform in its hue, the others grey.
 */
function SeparateScene() {
  return (
    <ul className="flex flex-col gap-1">
      {LANES.map(({ stem, name, rule }) => {
        const yours = stem === 'guitar'
        return (
          <li
            key={stem}
            className={cn(
              'grid grid-cols-[7rem_1fr] items-center gap-3 rounded-field py-2 pr-3 pl-2 sm:grid-cols-[9rem_1fr]',
              yours && 'inset-ring-[1.5px] inset-ring-selected',
            )}
          >
            <span className="flex items-center gap-2.5">
              <span aria-hidden className={cn('h-9 w-1 shrink-0 rounded-full', rule)} />
              <span className="flex min-w-0 flex-col">
                <span className={cn('text-label', !yours && 'text-muted-foreground')}>
                  {name()}
                </span>
                {yours && (
                  <span className="text-caption text-muted-foreground">
                    {m['mixer.your_part']()}
                  </span>
                )}
              </span>
            </span>
            <Peaks
              bins={64}
              shape={SHAPES[stem]}
              className={yours ? 'fill-stem-guitar' : 'fill-waveform-peak'}
            />
          </li>
        )
      })}
    </ul>
  )
}

const CHORDS = [
  { bar: 5, label: 'Am', confidence: 'high' },
  { bar: 6, label: 'F', confidence: 'high' },
  { bar: 7, label: 'C', confidence: 'high' },
  { bar: 8, label: 'G', confidence: 'low' },
] as const

function RowLabel({ children }: { children: string }) {
  return <span className="text-label-sm text-muted-foreground">{children}</span>
}

/** The beat over bars of your part: a long stroke on each downbeat, a short one on each beat. */
function Beats({ bars, className }: { bars: number; className?: string }) {
  const width = bars * 40
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 40`}
      preserveAspectRatio="none"
      className={cn('block h-10 w-full', className)}
    >
      {Array.from({ length: bars * 4 }, (_, beat) => {
        const x = beat * 10 + 0.5
        const down = beat % 4 === 0
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: beats are positional and never reorder
            key={beat}
            x={x}
            y={down ? 2 : 24}
            width={down ? 0.6 : 0.4}
            height={down ? 38 : 16}
            className={down ? 'fill-foreground' : 'fill-muted-foreground'}
          />
        )
      })}
    </svg>
  )
}

/** Step 3: the beat on your part, the chords (the unsure G marked) and the tab under them. */
function TranscribeScene() {
  return (
    <div className="flex flex-col gap-3">
      <RowLabel>{m['how.scene_beat']()}</RowLabel>
      <Beats bars={2} className="sm:hidden" />
      <Beats bars={4} className="max-sm:hidden" />
      <RowLabel>{m['how.scene_chords']()}</RowLabel>
      <div className="grid grid-cols-2 rounded-field bg-paper px-2 py-2 text-ink sm:grid-cols-4">
        {CHORDS.map((chord) => (
          <span key={chord.bar} className={cn('flex', chord.bar < 7 && 'max-sm:hidden')}>
            <ChordChip label={chord.label} confidence={chord.confidence} showUncertainty />
          </span>
        ))}
      </div>
      <RowLabel>{m['how.scene_tab']()}</RowLabel>
      <ReadingTab loop={false} playhead={null} />
    </div>
  )
}

/** Step 4: bars 5–8 looped and slowed to 70 %, the pass prompt in the transport. */
function PractiseScene() {
  return (
    <>
      <div className="p-3 sm:p-4 md:p-6">
        <ReadingTab />
      </div>
      <StillTransport after="pass" />
    </>
  )
}

const SCENES = [
  { title: () => m['how.scene_1_title'](), alt: () => m['how.scene_1_alt'](), Scene: ImportScene },
  {
    title: () => m['how.scene_2_title'](),
    alt: () => m['how.scene_2_alt'](),
    Scene: SeparateScene,
  },
  {
    title: () => m['how.scene_3_title'](),
    alt: () => m['how.scene_3_alt'](),
    Scene: TranscribeScene,
  },
  {
    title: () => m['how.scene_4_title'](),
    alt: () => m['how.scene_4_alt'](),
    Scene: PractiseScene,
    flush: true,
  },
] as const

/** The app window showing step `step` (0–3), as one image with a text alternative. */
export function HowStage({ step, className }: { step: number; className?: string }) {
  const scene = SCENES[step]
  if (!scene) return null
  const { title, alt, Scene } = scene
  // The practice picture runs its transport to the window's edges, like the app.
  const flush = 'flush' in scene
  return (
    <Still
      label={alt()}
      className={cn('rounded-panel border border-border bg-background', className)}
    >
      <div className="border-b border-border px-4 py-3 md:px-6">
        <span className="text-label-sm text-muted-foreground">{title()}</span>
      </div>
      {flush ? (
        <Scene />
      ) : (
        <div className="p-3 sm:p-4 md:p-6">
          <Scene />
        </div>
      )}
    </Still>
  )
}
